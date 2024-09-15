// Input field focus event listener
document.getElementById('txHash').addEventListener('focus', function () {
    // if (this.value === '0xb91739d318aaf8512f93d28ac3c404a7271c6cb48a21736a7460094043400c0e') {
    //     this.value = '';
    // }
    this.value = '';

});

// Window load event
window.onload = function () {
    // Get the transaction hash from the URL and decode the transaction
    getHashFromUrlAndDecode();
};

// Clipboard.js initialization
var clipboard = new ClipboardJS('#copyButton');

// Clipboard.js success event listener
clipboard.on('success', function (e) {
    // Set alert message
    setAlertMessage('Code Copy successfully!');
    // Show success alert
    showSuccessAlert();
    e.clearSelection();
});

// Set alert message function
function setAlertMessage(message) {
    $('#alert-message').text(message);
}

// Show success alert function
function showSuccessAlert() {
    $('#success-alert').fadeIn().delay(2000).fadeOut();
}