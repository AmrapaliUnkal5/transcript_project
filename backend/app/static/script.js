// Handle credential response from Google
function handleCredentialResponse(response) {
    const credential = response.credential;
  
    if (!credential) {
      console.error("Failed to retrieve credential from Google.");
      return;
    }
  
    console.log("JWT Token received:", credential); // Log token for debugging
  
    // Send the token to your backend
    fetch("http://127.0.0.1:8000/auth/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credential: credential, // Send token in the payload
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to authenticate with the backend.");
        }
        return response.json();
      })
      .then((data) => {
        console.log("Backend response:", data); // Handle backend response
        if (data.message === "Login Successful") {
          window.location.href = '/welcome';  // Redirect to welcome page on success
        } else {
          alert("Authentication failaaed!");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alert("An error occurred during authentication.");
      });
  }
  
  // Initialize the Google Sign-In process
  window.onload = function() {
    google.accounts.id.initialize({
      client_id: "752565494028-0ic7r9a791prp55aqkqe5lbjcaqfk9e1.apps.googleusercontent.com", // Replace with your Google Client ID
      callback: handleCredentialResponse, // Callback when token is received
    });
  
    google.accounts.id.renderButton(
      document.getElementById("g_signin"), // Element ID where the button will render
      { theme: "outline", size: "large" } // Button options
    );
  };