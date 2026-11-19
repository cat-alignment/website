/*
  Dropdowns on touch screens. There is no hover there, so the first tap on
  Events or Programmes opens its menu and a second tap follows the link.
  Tapping anywhere else closes it. Mouse users keep the hover menus.
*/
(() => {
  if (!window.matchMedia || !matchMedia("(hover: none)").matches) return;

  const items = document.querySelectorAll(".nav__item");
  const closeAll = (except) => {
    items.forEach((item) => {
      if (item === except) return;
      item.classList.remove("is-open");
      item.firstElementChild.setAttribute("aria-expanded", "false");
    });
  };

  items.forEach((item) => {
    const link = item.firstElementChild;
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      if (item.classList.contains("is-open")) return; // second tap: follow the link
      e.preventDefault();
      closeAll(item);
      item.classList.add("is-open");
      link.setAttribute("aria-expanded", "true");
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav__item")) closeAll(null);
  });
})();
