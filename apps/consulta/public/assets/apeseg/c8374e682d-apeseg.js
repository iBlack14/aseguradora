// (function ($) {
//   var nav = $(".site-header");

//   $(window).scroll(function () {
//     if ($(this).scrollTop() > 50) {
//       nav.addClass("nav-color");
//     } else {
//       nav.removeClass("nav-color");
//     }
//   });
// })(jQuery);

function openCity(evt, cityName) {
  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(cityName).style.display = "block";
  evt.currentTarget.className += " active";
}

function closeCity(cityName) {
  document.getElementById(cityName).style.display = "none";
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
}

var items = document.querySelectorAll(".our-history__item");
var lis = document.querySelectorAll(".our-history__li");
var postButtons = document.querySelectorAll("#next");
var prevButtons = document.querySelectorAll("#prev");

function updateButtons() {
  var activeIndex = Array.from(lis).findIndex((li) =>
    li.classList.contains("active")
  );
  postButtons.forEach((button) => {
    button.disabled = activeIndex === lis.length - 1;
    button.classList.toggle("disabled", button.disabled);
  });
  prevButtons.forEach((button) => {
    button.disabled = activeIndex === 0;
    button.classList.toggle("disabled", button.disabled);
  });
}

lis.forEach((li) => {
  li.addEventListener("click", function () {
    lis.forEach((li) => {
      li.classList.remove("active");
    });
    this.classList.add("active");

    var year = this.getAttribute("aria-year");

    items.forEach((item) => {
      item.classList.remove("active");
      if (item.id === year) {
        item.classList.add("active");
      }
    });

    updateButtons();
  });
});

postButtons.forEach((button) => {
  button.addEventListener("click", function () {
    var activeIndex = Array.from(lis).findIndex((li) =>
      li.classList.contains("active")
    );
    if (activeIndex < lis.length - 1) {
      lis[activeIndex].classList.remove("active");
      lis[activeIndex + 1].classList.add("active");

      var year = lis[activeIndex + 1].getAttribute("aria-year");

      items.forEach((item) => {
        item.classList.remove("active");
        if (item.id === year) {
          item.classList.add("active");
        }
      });

      updateButtons();
    }
  });
});

prevButtons.forEach((button) => {
  button.addEventListener("click", function () {
    var activeIndex = Array.from(lis).findIndex((li) =>
      li.classList.contains("active")
    );
    if (activeIndex > 0) {
      lis[activeIndex].classList.remove("active");
      lis[activeIndex - 1].classList.add("active");

      var year = lis[activeIndex - 1].getAttribute("aria-year");

      items.forEach((item) => {
        item.classList.remove("active");
        if (item.id === year) {
          item.classList.add("active");
        }
      });

      updateButtons();
    }
  });
});

// Inicializar el estado de los botones
updateButtons();
