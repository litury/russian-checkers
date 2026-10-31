import datetime
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import socket
import subprocess


SERVICE = 'app-copy-redundant-panel-sv2129'
DESTINATION = pathlib.Path('/var/backups/damka')
RETAIN_COPIES = 14


def write_json_atomic(destination, value):
    temporary = destination.with_suffix(destination.suffix + '.partial')
    with temporary.open('w') as output:
        json.dump(value, output, indent=2)
        output.write('\n')
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, destination)


def rotate_copies():
    copies = []
    for candidate in sorted(DESTINATION.glob('checkers-*.dump'), reverse=True):
        if candidate.is_symlink() or not re.fullmatch(r'checkers-\d{8}T\d{12}Z\.dump', candidate.name):
            continue
        manifest_path = candidate.with_suffix('.json')
        if not manifest_path.is_file() or manifest_path.is_symlink():
            continue
        try:
            metadata = json.loads(manifest_path.read_text())
        except (ValueError, OSError):
            continue
        if metadata.get('database') == 'checkers' and metadata.get('sha256'):
            copies.append(candidate)
    for expired in copies[RETAIN_COPIES:]:
        expired.unlink()
        expired.with_suffix('.json').unlink()


def table_manifest_sql():
    return r"""
SELECT format(
  'SELECT json_build_object(''table'', %L, ''rows'', count(*), ''digest'', md5(coalesce(string_agg(md5(row_to_json(record)::text), '''' ORDER BY md5(row_to_json(record)::text)), ''''))) FROM %I.%I AS record;',
  schemaname || '.' || tablename, schemaname, tablename
)
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
\gexec
SELECT json_build_object('indexes', coalesce(json_agg(indexdef ORDER BY tablename, indexname), '[]'))
FROM pg_indexes WHERE schemaname = 'public';
SELECT json_build_object('constraints', coalesce(json_agg(json_build_array(relation.relname, constraint_row.conname, pg_get_constraintdef(constraint_row.oid)) ORDER BY relation.relname, constraint_row.conname), '[]'))
FROM pg_constraint constraint_row JOIN pg_class relation ON relation.oid = constraint_row.conrelid
JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace WHERE namespace.nspname = 'public';
"""


def main():
    if socket.gethostname() != 'puppetgram-ru':
        raise RuntimeError('This backup targets puppetgram-ru only')
    os.umask(0o077)
    DESTINATION.mkdir(mode=0o700, parents=True, exist_ok=True)
    DESTINATION.chmod(0o700)
    with (DESTINATION / '.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if shutil.disk_usage(DESTINATION).free < 256 * 1024 * 1024:
            raise RuntimeError('Less than 256 MiB free; backup not started')
        identifiers = subprocess.check_output(['docker', 'ps', '-q', '--filter', 'label=com.docker.swarm.service.name=' + SERVICE], text=True).split()
        if len(identifiers) != 1:
            raise RuntimeError('Expected exactly one running database container')
        container = identifiers[0]
        details = json.loads(subprocess.check_output(['docker', 'inspect', container], text=True))[0]
        environment = dict(value.split('=', 1) for value in details['Config']['Env'] if '=' in value)
        username = environment['POSTGRES_USER']
        database = environment.get('POSTGRES_DB', username)
        if database != 'checkers':
            raise RuntimeError('Unexpected database name')
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        dump_path = DESTINATION / ('checkers-' + timestamp + '.dump')
        partial_path = dump_path.with_suffix('.partial')
        psql = ['docker', 'exec', '-i', container, 'psql', '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-U', username, '-d', database]
        session = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        try:
            session.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout = '30s';\nSET LOCAL idle_in_transaction_session_timeout = '150s';\nSELECT pg_export_snapshot();\n")
            session.stdin.flush()
            snapshot = session.stdout.readline().strip()
            if not snapshot or session.poll() is not None:
                raise RuntimeError('Cannot export database snapshot')
            with partial_path.open('xb') as output:
                subprocess.run(['docker', 'exec', container, 'pg_dump', '-U', username, '-d', database, '--format=custom', '--no-owner', '--no-acl', '--lock-wait-timeout=10s', '--snapshot=' + snapshot], stdout=output, check=True, timeout=120)
                output.flush()
                os.fsync(output.fileno())
            session.stdin.write(table_manifest_sql() + "\nSELECT 'DAMKA_MANIFEST_END';\nCOMMIT;\n")
            session.stdin.flush()
            manifest = []
            while True:
                line = session.stdout.readline().strip()
                if line == 'DAMKA_MANIFEST_END':
                    break
                if not line:
                    raise RuntimeError('Incomplete snapshot manifest')
                manifest.append(json.loads(line))
            session.stdin.close()
            if session.wait(timeout=10) != 0:
                raise RuntimeError('Snapshot transaction failed')
            digest = hashlib.sha256(partial_path.read_bytes()).hexdigest()
            manifest_path = dump_path.with_suffix('.json')
            write_json_atomic(manifest_path, {'createdAt': timestamp, 'database': database, 'sha256': digest, 'snapshot': manifest})
            os.replace(partial_path, dump_path)
            result = {'createdAt': timestamp, 'backup': str(dump_path), 'bytes': dump_path.stat().st_size, 'tables': len([entry for entry in manifest if 'table' in entry]), 'sha256': digest}
            rotate_copies()
            write_json_atomic(DESTINATION / 'last-success.json', result)
            print(json.dumps(result))
        finally:
            if session.poll() is None:
                session.terminate()
                try:
                    session.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    session.kill()
                    session.wait()
            if partial_path.exists():
                partial_path.unlink()


if __name__ == '__main__':
    main()
