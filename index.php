<?php
session_start(); 
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Komorebi - Watch Animes</title>
  <link rel="stylesheet" href="style.css" />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <header>
    <div class="logo">Komorebi</div>
    <nav>
      <ul class="nav-links">
        <li><a href="#">Home</a></li>
        <li><a href="#">Games</a></li>
        <li><a href="#">Preview</a></li>
        <li class="dropdown">
          <a href="#">More <span class="arrow">&#9662;</span></a>
          <ul class="dropdown-menu">
            <li><a href="#">Features</a></li>
            <li><a href="#">Services</a></li>
          </ul>
        </li>
      </ul>
      <?php if (isset($_SESSION['username'])): ?>
        <?php
          $username = $_SESSION['username'];
          $initials = strtoupper(substr($username, 0, 2)); 
        ?>
        <div class="user-profile dropdown">
            <div class="user-circle">
                <?php echo htmlspecialchars($initials); ?>
            </div>
            <ul class="dropdown-menu">
                <li><a href="logout.php">Logout</a></li>
            </ul>
        </div>
      <?php else: ?>
        <div class="auth-buttons">
          <a href="#" class="login" onclick="openModal('login')">Login</a>
          <a href="#" class="signup" onclick="openModal('signup')">Sign Up</a>
        </div>
      <?php endif; ?>
    </nav>
  </header>
  <section class="hero">
    <div class="slideshow">
      <div class="slide" style="background-image: url('img1.jpg');"></div>
      <div class="slide" style="background-image: url('img2.jpg');"></div>
      <div class="slide" style="background-image: url('img3.jpg');"></div>
      <div class="slide" style="background-image: url('img4.jpg');"></div>
    </div>
    <div class="hero-content">
      <h1>Explore the world of Anime</h1>
      <p>Stream your favorite anime in HD, anytime, anywhere.</p>
      <a href="#" class="cta-button">Start Watching</a>
    </div>
  </section>
  <section class="features">
    <div class="feature-box">
      <h2>HD Streaming</h2>
      <p>Enjoy all your favorite anime in high definition with minimal buffering.</p>
    </div>
    <div class="feature-box">
      <h2>Weekly Updates</h2>
      <p>Get access to the latest episodes as soon as they air.</p>
    </div>
    <div class="feature-box">
      <h2>Watchlist</h2>
      <p>Create your personal watchlist and never lose track of episodes.</p>
    </div>
  </section>
  <div id="auth-modal" class="auth-modal">
    <div class="auth-box fancy-box">
      <span class="close-btn" onclick="closeModal()">✕</span>
      <form id="login-form" class="auth-form" method="POST" style="display: none;">
        <h2>Login to Komorebi</h2>
        <input type="text" id="login_username_or_email" name="username_or_email" placeholder="Email or Username" required>
        <small id="login-hint-message" style="color: #ff9800; display: block; margin-top: 4px;"></small>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit" class="neon-button">Login</button>
      </form>
      <form id="signup-form" class="auth-form" method="POST" style="display: none;">
        <h2>Sign Up</h2>
        <input type="text" id="signup-username" name="username" placeholder="Username" required />
        <small id="username-hint" style="color: #ff9800; display: block; margin-top: 4px;"></small>
        <input type="email" id="signup-email" name="email" placeholder="Email" required />
        <small id="email-hint" style="color: #ff9800; display: block; margin-top: 4px;"></small>
        <input type="password" id="signup-password" name="password" placeholder="Password" required />
        <small id="password-hint" style="color: #ff9800; display: block; margin-top: 4px;"></small>
        <input type="password" id="signup-confirm-password" name="confirm_password" placeholder="Confirm Password" required />
        <small id="confirm-password-hint" style="color: #ff9800; display: block; margin-top: 4px;"></small>
        <button type="submit" class="neon-button">Sign Up</button>
      </form>
    </div>
  </div>
  <footer>
    <p>&copy; 2025 Komorebi. All rights reserved.</p>
    <a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a>
  </footer>
  <div id="messageBox"></div>
  <script>
    function openModal(type) {
      const modal = document.getElementById('auth-modal');
      const loginForm = document.getElementById('login-form');
      const signupForm = document.getElementById('signup-form');
      loginForm.reset();
      signupForm.reset();
      document.getElementById('login-hint-message').textContent = '';
      document.getElementById('username-hint').textContent = '';
      document.getElementById('email-hint').textContent = '';
      document.getElementById('password-hint').textContent = '';
      document.getElementById('confirm-password-hint').textContent = '';
      modal.style.display = 'flex';
      if (type === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
      }
    }
    function closeModal() {
      document.getElementById('auth-modal').style.display = 'none';
    }
    function showMessage(message, isSuccess = false) {
      const box = document.getElementById('messageBox');
      box.textContent = message;  
      if (isSuccess) {
        box.style.background = 'linear-gradient(to right, #4facfe, #00f2fe)';
      } else {
        box.style.background = 'linear-gradient(to right, #e52d27, #b31217)';
      }
      box.style.display = 'block';
      box.style.animation = 'none';
      void box.offsetWidth; 
      box.style.animation = 'fadeInOut 4s forwards';
      setTimeout(() => box.style.display = 'none', 4000); 
    }
    document.getElementById("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(this);
      fetch('login.php', {
        method: 'POST',
        body: formData
      })
      .then(res => res.text())
      .then(data => {
        if (data.includes("Login successful!")) {
          showMessage("Login successful!", true);
          closeModal();
          setTimeout(() => location.reload(), 1000); 
        } else {
          showMessage(data); 
        }
        this.reset();
      })
      .catch(err => {
        showMessage("Login failed. Please try again.");
        console.error(err);
      });
    });
    document.getElementById("signup-form").addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(this);
      fetch('signup.php', {
        method: 'POST',
        body: formData
      })
      .then(res => res.text())
      .then(data => {
        if (data.includes("Signup successful!")) {
          showMessage("Signup successful! You are now logged in.", true);
          closeModal();
          setTimeout(() => location.reload(), 1000); 
        } else {
          showMessage(data); 
        }
        this.reset();
      })
      .catch(err => {
        showMessage("Signup failed. Please try again.");
        console.error(err);
      });
    });  
    const loginInputField = document.getElementById("login_username_or_email");
    const loginHintMessage = document.getElementById("login-hint-message");
    if (loginInputField) {
        loginInputField.addEventListener("input", function () {
            const value = loginInputField.value.trim();
            if (value.includes("@")) {
                loginHintMessage.textContent = "📧 Enter a valid email like user@example.com";
            } else if (value.length > 0) {
                loginHintMessage.textContent = "👤 Username should be at least 4 characters, no spaces.";
            } else {
                loginHintMessage.textContent = "";
            }
        });
    }
    const signupUsername = document.getElementById("signup-username");
    const signupEmail = document.getElementById("signup-email");
    const signupPassword = document.getElementById("signup-password");
    const signupConfirmPassword = document.getElementById("signup-confirm-password");
    const usernameHint = document.getElementById("username-hint");
    const emailHint = document.getElementById("email-hint");
    const passwordHint = document.getElementById("password-hint");
    const confirmPasswordHint = document.getElementById("confirm-password-hint"); 
    if (signupUsername) {
        signupUsername.addEventListener("input", () => {
            const value = signupUsername.value.trim();
            if (value.length > 0 && value.length < 4) {
                usernameHint.textContent = "👤 Username must be at least 4 characters.";
            } else if (/\s/.test(value)) {
                usernameHint.textContent = "❌ Username should not contain spaces.";
            } else {
                usernameHint.textContent = "";
            }
        });
    }
    if (signupEmail) {
        signupEmail.addEventListener("input", () => {
            const value = signupEmail.value.trim();
            if (value.length > 0 && !value.includes("@")) {
                emailHint.textContent = "📧 Email must contain '@' like user@example.com.";
            } else {
                emailHint.textContent = "";
            }
        });
    }
    if (signupPassword) {
        signupPassword.addEventListener("input", () => {
            const value = signupPassword.value;
            if (value.length > 0 && value.length < 8) {
                passwordHint.textContent = "🔒 At least 8 characters required.";
            } else if (value.length > 0 && (!/[A-Z]/.test(value) || !/[0-9]/.test(value))) {
                passwordHint.textContent = "🔐 Add 1 capital letter and 1 number.";
            } else {
                passwordHint.textContent = "";
            }         
            if (signupConfirmPassword && signupConfirmPassword.value.length > 0) { 
                if (value !== signupConfirmPassword.value) {
                    confirmPasswordHint.textContent = "❌ Passwords do not match!";
                } else {
                    confirmPasswordHint.textContent = "";
                }
            }
        });
    }
    if (signupConfirmPassword) {
        signupConfirmPassword.addEventListener("input", () => {
            const password = signupPassword.value;
            const confirm = signupConfirmPassword.value;
            if (confirm.length > 0 && password !== confirm) {
                confirmPasswordHint.textContent = "❌ Passwords do not match!";
            } else {
                confirmPasswordHint.textContent = "";
            }
        });
    }    
    document.getElementById("signup-form").addEventListener("submit", function (e) {
        const username = signupUsername.value.trim();
        const email = signupEmail.value.trim();
        const password = signupPassword.value;
        const confirmPassword = signupConfirmPassword.value;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const usernamePattern = /^[A-Za-z0-9]{4,}$/;
        if (!usernamePattern.test(username)) {
            showMessage("Username must be at least 4 characters with no spaces.", false);
            e.preventDefault();
            return;
        }
        if (!emailPattern.test(email)) {
            showMessage("Enter a valid email like user@example.com", false);
            e.preventDefault();
            return;
        }
        if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            showMessage("Password must be at least 8 characters with one capital letter and one number.", false);
            e.preventDefault();
            return;
        }
        if (password !== confirmPassword) {
            showMessage("Passwords do not match!", false);
            e.preventDefault();
            return;
        }
    });
    document.getElementById("login-form").addEventListener("submit", function (e) {
        const value = loginInputField.value.trim();
        const password = this.password.value;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const usernamePattern = /^[A-Za-z0-9]{4,}$/;
        const isEmail = emailPattern.test(value);
        const isUsername = usernamePattern.test(value);
        if (!isEmail && !isUsername) {
            showMessage("Enter a valid email or username.", false);
            e.preventDefault();
            return;
        }
        if (password.length < 8) {
            showMessage("Password must be at least 8 characters long.", false);
            e.preventDefault();
            return;
        }
    });
  </script>
</body>
</html>