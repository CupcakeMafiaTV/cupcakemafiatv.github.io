// Color Switcher
var themeToggleBtn = document.getElementById('theme-toggle');

// Change the toggle state based on previous change
if ( localStorage.getItem('yt2-color-theme') === 'dark' ) {
  themeToggleBtn.checked = true;
  document.documentElement.classList.add('dark');
} else {
  themeToggleBtn.checked = false;
  document.documentElement.classList.remove('dark');
}

themeToggleBtn.addEventListener('change', function() {

  // if set via local storage previously
  if (localStorage.getItem('yt2-color-scheme')) {
    if (localStorage.getItem('yt2-color-theme') === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('yt2-color-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('yt2-color-theme', 'light');
    }
  // if NOT set via local storage previously
  } else {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('yt2-color-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('yt2-color-theme', 'dark');
    }
  }
});

// Product Slider
const swiperProductsNav = new Swiper('.js-vv-product-swiper-nav', {
  spaceBetween: 20,
  slidesPerView: 3,
  watchSlidesProgress: true,

  breakpoints: {
    576: {
      slidesPerView: 3,
    },
    768: {
      spaceBetween: 18,
      slidesPerView: 4,
    },
    992: {
      spaceBetween: 20,
      slidesPerView: 5,
    },
  },
});

const swiperProducts = new Swiper('.js-vv-product-swiper', {
  thumbs: {
    swiper: swiperProductsNav
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
  loopedSlides: 3,
  centeredSlides: true,
  spaceBetween: 20,
  speed: 500,

  autoplay: {
    delay: 10000,
    disableOnInteraction: false,
  },

  // Navigation arrows
  navigation: {
    nextEl: '.js-vv-hero-swiper-btn-next',
    prevEl: '.js-vv-hero-swiper-btn-prev',
  },

  on: {
    slideChange: function() {
      const currentIndex = this.realIndex;
      const currentSlide = this.slides[currentIndex];
      currentSlide.classList.add('vv-slide-played');
    }
  },
});


// Login/Register
if ( document.querySelector('.js-vv-modal') ) {
  const modalLogin = document.querySelector('#vv-modal-login');
  const openModalLogin = document.querySelectorAll('.vv-modal__open-btn-login');
  const closeModalLogin = document.querySelector('.vv-modal__close-btn-login');

  const modalRegister = document.querySelector('#vv-modal-register');
  const openModalRegister = document.querySelectorAll('.vv-modal__open-btn-register');
  const closeModalRegister = document.querySelector('.vv-modal__close-btn-register');

  // Login: show the modal by clicking on the button
  openModalLogin.forEach(element => {
    element.addEventListener('click', () => {
      modalLogin.showModal();
    });
  });

  // Loging: close the modal
  closeModalLogin.addEventListener('click', () => {
    modalLogin.close();
  });

  // Register: show the modal by clicking on the button
  openModalRegister.forEach(element => {
    element.addEventListener('click', () => {
      modalRegister.showModal();
    });
  });

  // Register: close the modal
  closeModalRegister.addEventListener('click', () => {
    modalRegister.close();
  });
}
