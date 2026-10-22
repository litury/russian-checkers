import '../features/settings/setupSettings';
import '../features/menu/setupMenu';
import '../features/menu/menuNavigation';
import '../features/menu/menuAtlas';
import '../features/menu/openingStats';
import '../features/menu/siegeOpeningBootstrap';
import '../features/menu/menuPressFeedback';
import '../platform/browser/pointerFocusRing';
import { bindMatchHistory } from '../features/profile/matchHistoryUi';
import './engineStartup';

bindMatchHistory();
