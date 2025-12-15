// ==UserScript==
// @name         Change Bill to Link
// @namespace    http://tampermonkey.net/
// @version      2025-12-15
// @description  Navigate from Owner Transactions to Vendor Bills
// @author       Natural Retreats Tech
// @run-at       document-end:
// @match        https://naturalretreats.trackhs.com/pms/owner/profiles/view*
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    const script = document.createElement('script');
    script.textContent = `
        async function saveBillLine(billId, lineId){
        try {

            console.log("saveBillLine", billId, lineId);
            const newDesc = document.querySelector("#ld" + lineId).value;
            const newMU = document.querySelector("#lm" + lineId).value;

            console.log(newDesc);
            console.log(newMU);
            
            const existingBillResp = await fetch('https://naturalretreats.trackhs.com/api/pms/accounting/bills/' + billId);
            if (!existingBillResp.ok) {
                console.error('Error getting existing vendor bill');
                return;
            }
            var eb = await existingBillResp.json();
            if (!eb){
                console.error('Error getting existing vendor bill');
                return;
            }

            const theOneLineBill = {
                "lines": [
                    eb.lines[0]
                ]
            };

            theOneLineBill.lines[0].unitAmount = Math.abs(theOneLineBill.lines[0].unitAmount);
            theOneLineBill.lines[0].amount = Math.abs(theOneLineBill.lines[0].amount);
            theOneLineBill.lines[0].description = newDesc;
            theOneLineBill.lines[0].markupPercentage = newMU;

            const updateResponse = await fetch('https://naturalretreats.trackhs.com/api/pms/accounting/bills/' + billId, {
            method: 'PATCH', // Specify the HTTP method as POST
            headers: {
            'Content-Type': 'application/json', // Indicate that the request body is JSON
            'Accept': 'application/json' // Optionally, tell the server we expect JSON back
            },
            body: JSON.stringify(theOneLineBill) // Convert the JavaScript object to a JSON string
            });

            if (!response.ok) {
                console.error('Error patching vendor bill');
            }

            // Test

            console.log('Success:');

        } catch (error) {
            console.error('Error:', error);
            throw error; // Re-throw the error for further handling
        }
    }`;
    document.head.appendChild(script);

    setTimeout(a, 1000);

    await a();

    async function a() {
        var ownerId = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
        var table = document.querySelector("#transactions-table");
        for (var i = 1, row; row = table.rows[i]; i++) {
            var chargeId = row.cells[0].innerText;
            var q = await fetch('https://naturalretreats.trackhs.com/api/pms/owners/' + ownerId + '/transactions/' + chargeId);

            var b = await q.json();
            if (b?._embedded?.parent && b._embedded.parent.type === "bill"){
                var billId = b._embedded.parent.id;
                var lineId = b._embedded.parent.lines[0].id;
                var eMU = b._embedded.parent.lines[0].markup;
                row.cells[0].innerHTML = "<a href='https://naturalretreats.trackhs.com/pms/bill/update/" + billId + "'>" + chargeId + "</a>";
                row.cells[5].innerHTML = "<div style='float: left; width: 80%; resize: none;'><textarea style='width: 100%; height:100%; resize: vertical; field-sizing: content; min-height: 3rem;' id='ld" + lineId + "'>" + row.cells[5].innerText + "</textarea></div><div style='float: right; min-width: 98px; width: 20%;' class='input-group'><input style='height: 100%;' id='lm" + lineId + "'class='form-control markup' value='" + eMU + "' type='number' min='0' step='.0001' name='markup[]'><div style='height: 100%;' class='input-group-text'>%</div></div>";
                row.cells[9].innerHTML = "<div class='btn-group'><button type='button' class='btn btn-primary btn-xs dropdown-toggle' data-toggle='dropdown' aria-haspopup='true' aria-expanded='false'>Actions <span class='caret'></span></button><ul class='dropdown-menu dropdown-menu-right'><li><a class='btn-save' onclick=saveBillLine(" + billId + "," + lineId + ")>Save</a></li></ul></div>";
            }
        }
    }

})();
