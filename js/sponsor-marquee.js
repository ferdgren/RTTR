(function () {
  var SPEED_PX_PER_FRAME = 0.6;
  var RESUME_DELAY_MS = 2000;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  document.querySelectorAll('.sponsor-marquee').forEach(function (marquee) {
    var track = marquee.querySelector('.sponsor-marquee__track');
    if (!track) return;

    var paused = false;
    var programmaticScroll = false;
    var resumeTimer = null;
    var halfWidth = track.scrollWidth / 2;

    window.addEventListener('resize', function () {
      halfWidth = track.scrollWidth / 2;
    });

    function scheduleResume() {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        paused = false;
      }, RESUME_DELAY_MS);
    }

    marquee.addEventListener('scroll', function () {
      if (programmaticScroll) {
        programmaticScroll = false;
        return;
      }
      paused = true;
      scheduleResume();
    }, { passive: true });

    marquee.addEventListener('mouseenter', function () {
      paused = true;
    });

    marquee.addEventListener('mouseleave', function () {
      if (resumeTimer) clearTimeout(resumeTimer);
      paused = false;
    });

    function tick() {
      if (!paused && halfWidth > 0) {
        programmaticScroll = true;
        marquee.scrollLeft += SPEED_PX_PER_FRAME;
        if (marquee.scrollLeft >= halfWidth) {
          marquee.scrollLeft -= halfWidth;
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
})();
