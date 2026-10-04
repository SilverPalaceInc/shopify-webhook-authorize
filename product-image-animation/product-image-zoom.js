// Usage: <div class="pz" data-zoom="2"><img class="pz__img" src="..." alt="..."></div>
(function () {
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  function init(root) {
    const img = root.querySelector('.pz__img');
    if (!img) return;

    const reveal = () => root.classList.add('is-loaded');
    if (img.complete && img.naturalWidth) reveal();
    else img.addEventListener('load', reveal, { once: true });

    const scale = parseFloat(root.dataset.zoom) || 2;

    function pan(e) {
      const r = root.getBoundingClientRect();
      const fx = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      const fy = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
      const tx = -(scale - 1) * fx * r.width;
      const ty = -(scale - 1) * fy * r.height;
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }

    root.addEventListener('pointerenter', (e) => {
      if (!canHover.matches || e.pointerType !== 'mouse') return;
      root.classList.add('is-zooming');
      pan(e);
    });
    root.addEventListener('pointermove', (e) => {
      if (root.classList.contains('is-zooming')) pan(e);
    });
    root.addEventListener('pointerleave', () => {
      // The base .pz__img transition eases the zoom-out back to rest.
      root.classList.remove('is-zooming');
      img.style.transform = '';
    });
  }

  document.querySelectorAll('.pz').forEach(init);
})();
