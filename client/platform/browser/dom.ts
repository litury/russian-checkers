export function requiredElement<ElementType extends HTMLElement = HTMLElement>(
	id: string,
): ElementType {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing interface element: ${id}`);
	return element as ElementType;
}
