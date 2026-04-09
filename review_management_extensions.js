// ==UserScript==
// @name         Review Management Extensions
// @namespace    http://tampermonkey.net/
// @version      2
// @run-at       document-body
// @match        https://naturalretreats.tracksandbox.io/ngui/crm/surveys/responses/responses*
// @match        https://naturalretreats.trackhs.com/ngui/crm/surveys/responses/responses*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @require      https://cdn.datatables.net/2.3.7/js/dataTables.min.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

function getApiHost()
{
    if (window.location.href.includes("https://naturalretreats.trackhs.com/"))
    {
        return "nrbeapi";
    } else
    {
        return "nrbeapi.stage";
    }
}

function safeTextUpdate(surveyId, element, newText, newTitle) {
    if (element) {
        const textNode = Array.from(element.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) {
            textNode.nodeValue = " " + newText + " ";
            element.setAttribute("title", newTitle);
        }
    }
}

const statusMap = new Map();

function resetTrackValue(surveyId, statusElement, linkElement) {
    if (statusElement) {
        const textNode = Array.from(statusElement.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
        if (textNode) {
            textNode.nodeValue = " " + statusMap.get(parseInt(surveyId, 10)) + " ";
            statusElement.removeAttribute("title");
        }
    }
    if (linkElement) {
        linkElement.href = "/ngui/crm/surveys/responses/responses/" + surveyId;
    }
}

let isDirty = false;

function flagDirty(){
    isDirty = true;
}

function flagClean(){
    isDirty = false;
}

function makeGetRequest(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            headers: {
                'x-api-key': getCookie("rmkey")
            },
            onload: r => {
                resolve(r);
            },
            onerror: e => reject(e)
        });
    });
}

function makePatchRequest(url, bodyObj) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: "PATCH",
            url: url,
            data: JSON.stringify(bodyObj),
            headers: {
                'x-api-key': getCookie("rmkey"),
                'Content-Type': 'application/json'
            },
            onload: r => {
                resolve(r);
            },
            onerror: e => {
                reject(e);
            }
        });
    });
}

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

async function getReviewStatuses(surveyIds) {
    const statuses = new Map();
    const surveyIdParams = new URLSearchParams();
    surveyIds.forEach((surveyId) => {
        statuses.set(surveyId, null);
        surveyIdParams.append("id", surveyId);
    });

    const url = new URL(`https://${getApiHost()}.naturalretreats.com/management/reviews/track-status?` + surveyIdParams.toString());
    const response = await makeGetRequest(url);
    const foundReviews = JSON.parse(response.responseText);

    statuses.forEach((review, id) => {
        const foundReview = foundReviews.find(r => r.id === id);

        if (foundReview) {
            statuses.set(id, {status: foundReview.isPublished ? "published" : "publishable", response: foundReview.response });
        }
    });
    return statuses;
}

async function getReviewStatus(surveyId) {
    let status = null;
    const url = new URL(`https://${getApiHost()}.naturalretreats.com/management/reviews/track-status/` + surveyId);
    const response = await makeGetRequest(url);
    const foundReview = JSON.parse(response.responseText);
    if (foundReview && foundReview.id){
        status = {status: foundReview.isPublished ? "published" : "publishable", response: foundReview.response };
    }
    return status;
}

function openApiKeyForm() {
    const credPopup = document.createElement('dialog');
    credPopup.id = "apikeypopup";
    credPopup.style.width = "350px";
    credPopup.style.height = "480px";
    var heading = document.createElement("h2");
    heading.innerText = "Enter your API Key";
    var apiKey = document.createElement("input");
    apiKey.id = "apikey";
    apiKey.type= "password";
    apiKey.name = "apikey";
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Save";
    submit.addEventListener('click', closeApiKeyForm, false);
    credPopup.appendChild(heading);
    credPopup.appendChild(apiKey);
    credPopup.appendChild(submit);
    document.body.appendChild(credPopup);
    credPopup.showModal();
}
function closeApiKeyForm() {
    var apiKey = document.getElementById("apikey").value;
    if (apiKey) document.cookie = `rmkey=${apiKey}`;
    document.getElementById("apikeypopup").close();
    window.location.reload();

}

async function saveReviewStatus(surveyId) {
    document.body.style.cursor = 'progress';
    const nrpublishflag = document.getElementById('nrpublishflag');
    const nrresponse = document.getElementById('nrresponse');
    const url = new URL(`https://${getApiHost()}.naturalretreats.com/management/reviews/track/` + surveyId + '/status');
    await makePatchRequest(url, {published: nrpublishflag.checked, response: nrresponse.value});
    const newValues = await getReviewStatus(surveyId);
    nrpublishflag.check = newValues === "published";
    nrresponse.value = newValues.response;
    flagClean();
    document.body.style.cursor = 'default';
    history.back();
}

(async function() {

    const observer = new MutationObserver(async function(mutations, observer) {
        // Handle the mutations here
        for (let mutation of mutations) {
            // Tracks UI utilizes a "DATATABLE-PROGRESS" element to clue the user that
            // something is loaded. We will fire our update to coincide with that
            // progress bar being removed to start our loading
            if (mutation.type === "childList"
                && mutation.target.nodeName === "DATATABLE-BODY"
                && mutation.removedNodes[0] && mutation.removedNodes[0].nodeName === "DATATABLE-PROGRESS") {
                document.body.style.cursor = 'progress';
                var dt = mutation.target;

                var rows = dt.querySelectorAll("datatable-body-row div.datatable-row-center");
                if (rows.length === 0) continue;

                var surveyIds = [...rows].map(function(r) {
                    return r.querySelector("datatable-body-cell:nth-child(1) div").innerText;
                });

                const reviewStatuses = await getReviewStatuses(surveyIds);

                rows.forEach((r) => {
                    var surveyIdElement = r.querySelector("datatable-body-cell:nth-child(1) div");
                    var statusElement = r.querySelector("datatable-body-cell:nth-child(5) div");
                    var linkElement = r.querySelector("datatable-body-cell:nth-child(7) div a");
                    var surveyId = surveyIdElement.innerText;
                    resetTrackValue(surveyId, statusElement, linkElement);

                    const reviewStatus = reviewStatuses.get(surveyId);

                    if (reviewStatus) {

                        safeTextUpdate(surveyId, statusElement, reviewStatus.status, reviewStatus.response);

                        // Track appears to use event handler to invoke the detail page despite the
                        // anchor tag so remove event handler by cloning and replacing to ensure
                        // bfcache doesn't cause issues
                        var linkElement = r.querySelector("datatable-body-cell:nth-child(7) div a");
                        var newlinkElement = linkElement.cloneNode(true);
                        linkElement.parentNode.replaceChild(newlinkElement, linkElement);
                    }

                });
                document.body.style.cursor = 'default';
            }

            const reviewElement = document.getElementById("nrwebsitereview");
            if (reviewElement) continue;

            window.addEventListener('beforeunload', function (e) {
                if (isDirty) {
                    console.log("unsaved survey changes");
                    // Cancel the event and show alert that the unsaved changes would be lost.
                    e.preventDefault();
                    // The returnValue property must be set for cross-browser compatibility
                    e.returnValue = '';
                }
            });

            if (mutation.type === "childList" && mutation.target.nodeName === "DIV" && mutation.target.id === "wrap" ) {

                var url = window.location.href;
                url = url.split('/');
                if (!isNaN(url[url.length-1])) {

                    const surveyId = url[url.length - 1];
                    const reviewStatus = await getReviewStatus(surveyId);
                    console.log(reviewStatus);

                    var oi = mutation.target;
                    var ter = oi.querySelectorAll("app-response-detail div.container-fluid div.row div.info-pane");
                    if (ter.length > 0 && reviewStatus) {
                        // add new horizontal rule for pleasantries
                        const hrs = ter[0].querySelectorAll("hr:first-of-type");
                        const newhr = hrs[0].cloneNode(true);
                        ter[0].appendChild(newhr);

                        // add category
                        const sT = document.createElement("h4");
                        sT.innerText = 'Website Review';
                        ter[0].appendChild(sT);

                        // configure the data list
                        const dls = ter[0].querySelectorAll("dl:last-of-type");
                        const newDl = dls[0].cloneNode(true);
                        newDl.replaceChildren();
                        newDl.setAttribute("id", "nrwebsitereview");

                        // published flag
                        const newDt1 = document.createElement("dt");
                        newDt1.setAttribute("class", "col-sm-4");
                        newDt1.innerText = "Published";
                        const newDd1 = document.createElement("dd");
                        newDd1.setAttribute("class", "col-sm-8 text-truncate");
                        newDd1.innerHTML = "<input id='nrpublishflag' type='checkbox' " + (reviewStatus.status === "published" ? 'checked' : '') + " />";
                        newDd1.querySelector('#nrpublishflag').addEventListener('change', flagDirty);
                        // response
                        const newDt2 = document.createElement("dt");
                        newDt2.setAttribute("class", "col-sm-4");
                        newDt2.innerText = "Response";
                        const newDd2 = document.createElement("dd");
                        newDd2.setAttribute("class", "col-sm-8 text-truncate");
                        newDd2.innerHTML = "<textarea id='nrresponse' rows='8' style='width:100%'>" + reviewStatus.response + "</textarea>";
                        newDd2.querySelector('#nrresponse').addEventListener('change', flagDirty);

                        // save button
                        const newDt3 = document.createElement("button");
                        newDt3.addEventListener('click', async => saveReviewStatus(surveyId));
                        newDt3.innerText = "Save Changes";

                        newDl.appendChild(newDt1);
                        newDl.appendChild(newDd1);
                        newDl.appendChild(newDt2);
                        newDl.appendChild(newDd2);
                        newDl.appendChild(newDt3);

                        ter[0].appendChild(newDl);
                    }
                }
            }
        }
    });

    var proxied = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function() {
        this.addEventListener("readystatechange", function() {
            // Check if the request is complete (readyState 4) and has a response
            // capture from the API call the original values because
            // we will have to manage restoring this as a user pages
            if (this.readyState === 4 && this.responseText.length > 0 && this.responseURL.includes("/api/crm/surveys/responses/")) {
                var r = JSON.parse(this.responseText);
                r._embedded.responses.forEach((sr) => {
                    statusMap.set(sr.id, sr.status);
                });
            }

        });
        return proxied.apply(this, [].slice.call(arguments));
    };

    const targetElement = document.body;
    observer.observe(targetElement, { childList: true, subtree: true });

    let apiKey = getCookie("rmkey");
    if (!apiKey) {
        openApiKeyForm();
    }

})();
