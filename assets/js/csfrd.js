/*
	CSFRD homepage figure — arms the hidden start state, then plays the
	"lighting up" sequence once the figure scrolls into view.
	Without JS (or with reduced motion) the figure simply shows complete.
*/

(function() {
	var fig = document.querySelector('.csfrd-figure');
	if (!fig || !('IntersectionObserver' in window)) return;
	if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	// Measure each curve so CSS can draw it on with stroke-dashoffset.
	fig.querySelectorAll('.curve').forEach(function(path) {
		path.style.setProperty('--len', path.getTotalLength());
	});

	fig.classList.add('is-armed');

	var observer = new IntersectionObserver(function(entries) {
		entries.forEach(function(entry) {
			if (entry.isIntersecting) {
				fig.classList.add('is-lit');
				observer.disconnect();
			}
		});
	}, { threshold: 0.45 });

	observer.observe(fig);
})();
