// Color Switcher
var themeToggleBtn = document.getElementById('theme-toggle');

// Change the toggle state based on previous change
if ( localStorage.getItem('yt1-color-theme') === 'dark' ) {
  themeToggleBtn.checked = true;
  document.documentElement.classList.add('dark');
} else {
  themeToggleBtn.checked = false;
  document.documentElement.classList.remove('dark');
}

themeToggleBtn.addEventListener('change', function() {

  // if set via local storage previously
  if (localStorage.getItem('yt1-color-scheme')) {
    if (localStorage.getItem('yt1-color-theme') === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('yt1-color-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('yt1-color-theme', 'light');
    }
  // if NOT set via local storage previously
  } else {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('yt1-color-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('yt1-color-theme', 'dark');
    }
  }
});

// Product Slider
const swiperProducts = new Swiper('.js-vv-product-swiper', {
  direction: 'horizontal',
  loop: true,

  // Navigation arrows
  navigation: {
    nextEl: '.vv-product-swiper-btn-next',
    prevEl: '.vv-product-swiper-btn-prev',
  },
});

// Playlists Slider
const swiperPlaylists = new Swiper('.js-vv-playlist-swiper', {
  slidesPerView: 1,
  spaceBetween: 0,
  centeredSlides: true,
  loop: true,

  breakpoints: {
    576: {
      slidesPerView: 2,
    },
    768: {
      slidesPerView: 2,
    },
    992: {
      slidesPerView: 3,
    },
    1210: {
      slidesPerView: 4,
    },
  },

  // Navigation arrows
  navigation: {
    nextEl: '.vv-playlist-swiper-btn-next',
    prevEl: '.vv-playlist-swiper-btn-prev',
  },
});

// Latest Videos Slider
const swiperLatestVideos = new Swiper('.js-vv-latest-videos-swiper', {
  slidesPerView: 1,
  spaceBetween: 30,
  loop: true,

  breakpoints: {
    576: {
      slidesPerView: 2,
    },
    768: {
      slidesPerView: 3,
    },
    992: {
      slidesPerView: 4,
    },
    1210: {
      slidesPerView: 5,
    },
  },

  // Navigation arrows
  navigation: {
    nextEl: '.js-vv-latest-videos-swiper-btn-next',
    prevEl: '.js-vv-latest-videos-swiper-btn-prev',
  },
});

// Featured Gaming Slider
const swiperFeaturedGaming = new Swiper('.js-vv-videos-swiper', {
  slidesPerView: 1,
  spaceBetween: 30,
  loop: true,

  breakpoints: {
    576: {
      slidesPerView: 2,
    },
    768: {
      slidesPerView: 3,
    },
    992: {
      slidesPerView: 4,
    },
    1210: {
      slidesPerView: 5,
    },
  },

  // Navigation arrows
  navigation: {
    nextEl: '.js-vv-videos-swiper-btn-next',
    prevEl: '.js-vv-videos-swiper-btn-prev',
  },
});

// Featured Videos
const swiperFeaturedVideos = new Swiper('.js-vv-videos-featured-swiper', {
  slidesPerView: 1,
  spaceBetween: 30,
  loop: true,

  breakpoints: {
    576: {
      slidesPerView: 2,
    },
    768: {
      slidesPerView: 5,
    },
    992: {
      slidesPerView: 4,
    },
    1210: {
      slidesPerView: 7,
    },
  },

  // Navigation arrows
  navigation: {
    nextEl: '.js-vv-videos-featured-swiper-btn-next',
    prevEl: '.js-vv-videos-featured-swiper-btn-prev',
  },
});


// Info Slider
const swiperChannelInfo = new Swiper('.js-vv-channel-info-swiper', {
  slidesPerView: 1,
  loop: true,
  parallax: true,
  speed: 1000,
  pagination: {
    el: '.js-vv-channel-info-swiper-pagination',
    type: 'bullets',
    clickable: true,
    bulletClass: 'js-vv-pagination-bullet',
    bulletActiveClass: 'js-vv-pagination-bullet-active',
  },

  // Navigation arrows
  navigation: {
    nextEl: '.js-vv-channel-info-swiper-btn-next',
    prevEl: '.js-vv-channel-info-swiper-btn-prev',
  },
});

// Hero Slider
const swiperHeroSlider = new Swiper('.js-vv-hero-swiper', {
  slidesPerView: 1,
  loop: true,
  parallax: true,
  speed: 500,

  effect: 'fade',
  fadeEffect: {
    crossFade: true
  },

  autoplay: {
    delay: 8000,
    disableOnInteraction: false,
  },

  pagination: {
    el: '.js-vv-hero-swiper-pagination',
    clickable: true,
    renderBullet: function (index, className) {
      return '<span class="' + className + ' w-4 h-4 m-0 opacity-100 bg-none bg-transparent">'+'<svg class="w-4 h-4" viewBox="0 0 16 16">'+ '<circle class="path" cx="8" cy="8" r="7" fill="none" transform="rotate(-90 8 8)" stroke="#fff1a5"'+ 'stroke-opacity="1" stroke-width="2px"></circle>'+
      '<circle cx="8" cy="8" r="3" fill="none" stroke-width="2px" stroke="#ffffff"></circle>'+
      '</svg></span>';
      },
  },

  on: {
    slideChange: function() {
      const currentIndex = this.realIndex;
      const currentSlide = this.slides[currentIndex];
      currentSlide.classList.add('vv-slide-played');
    }
  },
});
