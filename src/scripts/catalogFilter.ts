interface CatalogFilterOptions {
  searchId: string;
  gridId: string;
  emptyId: string;
  /** Element holding the filter buttons, with `data-active-class` / `data-inactive-class`. */
  filtersId: string;
  cardSelector: string;
}

/** Search + category filtering for the tool/game index pages. Reads `?cat=` and `?q=` on load. */
export function initCatalogFilter(o: CatalogFilterOptions) {
  const search = document.getElementById(o.searchId) as HTMLInputElement;
  const grid = document.getElementById(o.gridId)!;
  const empty = document.getElementById(o.emptyId)!;
  const filters = document.getElementById(o.filtersId)!;
  const buttons = filters.querySelectorAll<HTMLButtonElement>("button[data-filter]");
  const cards = document.querySelectorAll<HTMLElement>(o.cardSelector);
  const activeClasses = filters.dataset.activeClass!.split(" ");
  const inactiveClasses = filters.dataset.inactiveClass!.split(" ");

  let activeCategory = "all";

  function update() {
    const q = search.value.toLowerCase().trim();
    let visible = 0;
    cards.forEach((card) => {
      const ok =
        (activeCategory === "all" || card.dataset.category === activeCategory) &&
        (!q || card.dataset.title!.includes(q) || card.dataset.tags!.includes(q));
      card.style.display = ok ? "" : "none";
      if (ok) visible++;
    });
    empty.classList.toggle("hidden", visible > 0);
    grid.classList.toggle("hidden", visible === 0);
  }

  function select(category: string) {
    activeCategory = category;
    buttons.forEach((b) => {
      const on = b.dataset.filter === category;
      b.classList.remove(...(on ? inactiveClasses : activeClasses));
      b.classList.add(...(on ? activeClasses : inactiveClasses));
      b.setAttribute("aria-pressed", String(on));
    });
    update();
  }

  search.addEventListener("input", update);
  buttons.forEach((b) => b.addEventListener("click", () => select(b.dataset.filter!)));

  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  if (q) search.value = q;
  const cat = params.get("cat");
  select(cat && [...buttons].some((b) => b.dataset.filter === cat) ? cat : "all");
}
