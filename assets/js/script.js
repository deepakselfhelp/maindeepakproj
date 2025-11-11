/* ============================================
   RealCoachDeepak - Script.js
   Handles FAQ toggles + smooth scroll
============================================ */

// ---------- FAQ TOGGLE ----------
const faqItems = document.querySelectorAll(".faq-item");

faqItems.forEach(item => {
  const question = item.querySelector(".faq-question");
  question.addEventListener("click", () => {
    // Close others
    faqItems.forEach(i => {
      if (i !== item) i.querySelector(".faq-answer").style.display = "none";
    });

    // Toggle current
    const answer = item.querySelector(".faq-answer");
    const isVisible = answer.style.display === "block";
    answer.style.display = isVisible ? "none" : "block";
  });
});

// ---------- SMOOTH SCROLL ----------
const navLinks = document.querySelectorAll('a[href^="#"]');
navLinks.forEach(link => {
  link.addEventListener("click", e => {
    const targetId = link.getAttribute("href").substring(1);
    const target = document.getElementById(targetId);
    if (target) {
      e.preventDefault();
      window.scrollTo({
        top: target.offsetTop - 60,
        behavior: "smooth"
      });
    }
  });
});
