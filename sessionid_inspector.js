// ==UserScript==
// @name         SessionId Inspector
// @version      1
// @author       NR Tech
// @match        https://aemdev.callistavacations.com/booking
// @match        https://aemstage.callistavacations.com/booking
// @match        https://aemdev.naturalretreats.com/booking
// @match        https://aemstage.naturalretreats.com/booking
// @match        https://aemdev.360blue.com/booking
// @match        https://aemstage.360blue.com/booking
// @grant        none
// ==/UserScript==

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        // Remove leading spaces
        while (c.charAt(0) === ' ') {
            c = c.substring(1, c.length);
        }
        // If the cookie name is found, return its value
        if (c.indexOf(nameEQ) === 0) {
            // Decode the value before returning
            return decodeURIComponent(c.substring(nameEQ.length, c.length));
        }
    }
    return null; // Return null if the cookie is not found
}

function saveSessionToClipboard() {
  // Get the field
  var session = document.getElementById("sessionid-value");

   navigator.clipboard.writeText(session.innerText);

}


(function() {
    'use strict';
    console.log(getCookie("nret%5BsessionId%5D"));
    const s = document.createElement("div");
    const t = document.createElement("span");
    const u = document.createElement("i");
    s.id = "sessionid-container";
    t.id = "sessionid-value";
    t.textContent = getCookie("nret%5BsessionId%5D");
    u.setAttribute("class","fa-solid fa-copy");
    u.addEventListener("click", () => {
        saveSessionToClipboard();

    });

    s.appendChild(t);
    s.appendChild(u);

    var a = document.querySelector('#overlay');
    a.parentNode.insertBefore(s,a);
})();
