// Color Switcher
var themeToggleBtn = document.getElementById('theme-toggle');

// Change the toggle state based on previous change
if ( localStorage.getItem('str2-color-theme') === 'dark' || (!('str2-color-theme' in localStorage) )) {
  themeToggleBtn.checked = true;
  document.documentElement.classList.add('dark');
} else {
  themeToggleBtn.checked = false;
  document.documentElement.classList.remove('dark');
}

themeToggleBtn.addEventListener('change', function() {

  // if set via local storage previously
  if (localStorage.getItem('str2-color-scheme')) {
    if (localStorage.getItem('str2-color-theme') === 'light') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('str2-color-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('str2-color-theme', 'light');
    }
  // if NOT set via local storage previously
  } else {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('str2-color-theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('str2-color-theme', 'dark');
    }
  }
});

// Social Links Floating
if (document.querySelector('.js-vv-social-links-floating-toggle')) {
  const socialLinksFloatingToggle = document.querySelector('.js-vv-social-links-floating-toggle');

  socialLinksFloatingToggle.onclick = () => {
    socialLinksFloatingToggle.classList.toggle('active');
  };
}

// Streams Filter
if (document.querySelector('.js-vv-streams-filter-toggle')) {
  const streamsFilterToggle = document.querySelector('.js-vv-streams-filter-toggle');

  streamsFilterToggle.onclick = () => {
    streamsFilterToggle.classList.toggle('active');
  };
}


// Login/Register
if ( document.querySelector('.js-vv-modal') ) {
  const modal = document.querySelector('.js-vv-modal');
  const openModals = document.querySelectorAll('.js-vv-modal__open-btn-login-register');

  // show the modal by clicking on the button

  openModals.forEach(element => {
    element.addEventListener('click', () => {
      modal.showModal();
    });
  });
}

// Product Slider
const swiperProductsNav = new Swiper('.js-vv-product-swiper-nav', {
  spaceBetween: 20,
  slidesPerView: 4,
  watchSlidesProgress: true,
  loop: false,
  direction: 'vertical',

  breakpoints: {
    576: {
      slidesPerView: 4,
    },
    768: {
      spaceBetween: 20,
      slidesPerView: 4,
    },
    992: {
      spaceBetween: 20,
      slidesPerView: 4,
    },
  },
});

const swiperProducts = new Swiper('.js-vv-product-swiper', {
  loop: false,
  thumbs: {
    swiper: swiperProductsNav
  },
});
