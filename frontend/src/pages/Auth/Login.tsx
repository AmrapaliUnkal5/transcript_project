declare global {
  interface Window {
    google: any;
  }
}

import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AlertCircle, Facebook, Apple,} from "lucide-react";
import { authApi } from "../../services/api";
import { AxiosError } from "axios";
import { useAuth } from "../../context/AuthContext";
//import axios from "axios";
import { Box, styled, TextField, Typography,IconButton, InputAdornment } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { RefreshCcw } from "lucide-react"; // Import Lucide icon
import { useLoader } from "../../context/LoaderContext";
import { Visibility, VisibilityOff } from "@mui/icons-material"; 
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

export const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(false);
  //const [loading, setLoading] = useState(false);
  const { loading, setLoading } = useLoader(); // Use global loading state
  const [error, setError] = useState<string | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(
    location.state?.message || null
  );
  const [showPassword, setShowPassword] = React.useState(false); // State to manage password visibility

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const fetchCaptcha = async () => {
    try {
      const captchaUrl = await authApi.fetchCaptcha();
      setCaptchaImage(captchaUrl);
    } catch (error) {
      console.error("Failed to load CAPTCHA", error);
    }
  };
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleClickShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleCredentialResponse = async (response: { credential: string }) => {
    console.log("Credential response:", response);
    if (response.credential) {
      try {
        const res = await authApi.googleLogin(response.credential);
        console.log(res);
        login(res.access_token, res.user);
        const from = location.state?.from?.pathname || "/";
        navigate(from, { replace: true });
      } catch (error) {
        console.error("Error during Google authentication:", error);
        setError("Google authentication failed");
      }
    } else {
      console.error("Google login failed");
    }
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log("Google API script loaded successfully");
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id:
            "752565494028-0ic7r9a791prp55aqkqe5lbjcaqfk9e1.apps.googleusercontent.com",
          callback: handleCredentialResponse,
          access_type: "offline",
          prompt: "consent",
        });

        window.google.accounts.id.renderButton(
          document.getElementById("g_signin"),
          { theme: "outline", size: "large", text: "none" }
        );
      }
    };

    script.onerror = () => {
      console.error("Failed to load the Google API script");
    };

    document.body.appendChild(script);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!captchaInput.trim()) {
      setCaptchaError("Please enter the CAPTCHA text");
      setLoading(false);
      return;
    }
    setCaptchaError("");
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false); // Reset loading state after completion
    }, 2000);
    try {
      const captchaRes = await authApi.validatecaptcha(captchaInput);
      console.log("CAPTCHA Response:", captchaRes); // Debugging output
      if (!captchaRes.valid) {
        setCaptchaError("Incorrect CAPTCHA. Try again.");
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("Error validating CAPTCHA:", error);
      setCaptchaError("CAPTCHA validation failed.");
      setLoading(false);
    }

    try {
      const response = await authApi.login({ email, password });
      login(response.access_token, response.user);

      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail || "An unexpected error occurred");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    try {
      console.log(`Logging in with ${provider}`);
    } catch (err) {
      setError(`Failed to login with ${provider}`);
    }
  };

  return (
    <DarkGBox bgcolor="#f2f1ef" minHeight={"100vh"} >
      <Box bgcolor={"#000"}>
        <Box maxWidth={1180} mx={"auto"} borderRadius={4} py={2} px={3}>
          <Box display={'flex'} gap={1}>
             <SmartToyOutlinedIcon sx={{color: '#6a4cff'}} /> 
             <Typography variant="body1" fontFamily={'monospace'} color="#4dc4ff">ChatBot</Typography>
           </Box>  
        </Box>
      </Box>
      <Box maxWidth={1180} mx={"auto"} borderRadius={4} py={2} px={3}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <LightGBox p={'1px'} borderRadius={4}>
              <Box px={5} py={2} borderRadius={4}
                sx={{background:'url(/images/dummy/chatbot-blue.jpeg)', backgroundSize:'cover', backgroundRepeat:'no-repeat', backgroundPosition:'center', minHeight: '74vh'}}
              >
                <Typography variant="h6" mb={3} color="#FFF">
                  Check me
                </Typography>
                <Box textAlign={"center"}>
                  {/* <StyledImage
                    src="/images/dummy/chatbot-blue.jpeg"
                    sx={{ margin: "auto", borderRadius: "16px", maxWidth: 525 }}
                  /> */}
                </Box>
              </Box>
            </LightGBox>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <LightGBox
              minHeight={"100%"}
              px={5}
              py={2}
              bgcolor={"#FFF"}
              borderRadius={4}
            >
              <Typography variant="h6" mb={3} textAlign={"center"}>
                Login with Email
              </Typography>

              <Box px={2}>
                {error && (
                  <Box
                    mb={2}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color="error.main"
                  >
                    <AlertCircle size={16} style={{ marginRight: 8 }} />
                    <Typography variant="body2">{error}</Typography>
                  </Box>
                )}
                {successMessage && (
                  <Box mb={2} textAlign="center" color="success.main">
                    {successMessage}
                  </Box>
                )}
                <Grid container spacing={3}>
                  <Grid size={12}>
                    <TextField
                      id="email"
                      label="Enter your email id"
                      variant="standard"
                      size="small"
                      fullWidth
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      id="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      variant="standard"
                      size="small"
                      fullWidth
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleClickShowPassword}
                            edge="end"
                          >
                            {showPassword ? <Visibility /> : <VisibilityOff />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                   <div className="mt-4 flex items-center space-x-2">
                      <img
                        src={captchaImage}
                        alt="CAPTCHA"
                        className="w-32 h-12 border rounded-md"
                      />
                      <button
                        type="button"
                        onClick={fetchCaptcha}
                        className="p-1 rounded-md hover:bg-gray-200"
                      >
                        <RefreshCcw size={20} className="text-blue-600" />
                      </button>
                      <input
                        type="text"
                        placeholder="Enter CAPTCHA"
                        value={captchaInput}
                        onChange={(e) => {
                          setCaptchaInput(e.target.value);
                          if (e.target.value.trim()) setCaptchaError("");
                        }}
                        className="p-2 border rounded-md w-36"
                      />
                    </div>
                    {captchaError && (
                      <p className="text-red-500 text-sm mt-1">
                        {captchaError}
                      </p>
                    )}
                    </Grid>
                  
                  {/* <Grid size={12}>
                    <StyledImage
                      src="/images/temp/captcha.png"
                      sx={{ margin: "auto" }}
                    />
                  </Grid> */}

                  <Grid size={12}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <input
                          id="remember-me"
                          name="remember-me"
                          type="checkbox"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label
                          htmlFor="remember-me"
                          className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
                        >
                          Remember me
                        </label>
                      </div>

                      <div className="text-sm">
                        <Link
                          to="/forgot-password"
                          className="font-medium text-blue-600 hover:text-blue-500"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                    </div>
                  </Grid>
                  <Grid size={12}>
                    <div>
                      <button
                        type="submit"
                        disabled={loading}
                        className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                          loading
                            ? "bg-blue-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        }`}
                        onClick={handleSubmit}
                      >
                        {loading ? "Signing in..." : "Sign in"}
                      </button>
                    </div>
                    <Box my={3}>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
                            Or continue with
                          </span>
                        </div>
                      </div>
                    </Box>
                    <div className="grid grid-cols-3 gap-3">
                      <div id="g_signin" className="w-full"></div>

                      <button
                        type="button"
                        onClick={() => handleSocialLogin("facebook")}
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Facebook className="w-5 h-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSocialLogin("apple")}
                        className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Apple className="w-5 h-5" />
                      </button>
                    </div>
                    <Box mt={3}>
                      <div className="text-center">
                        <Link
                          to="/signup"
                          className="font-medium text-blue-600 hover:text-blue-500"
                        >
                          Don't have an account? Sign up
                        </Link>
                      </div>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </LightGBox>
          </Grid>
        </Grid>
        <Box mt={2}>
          <LightGBox px={5} py={2} bgcolor={"#FFF"} borderRadius={4}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box>
                  <Typography variant="body1">Have Questions ? </Typography>
                  <Typography variant="body2">Visit our FAQ Section</Typography>
                  <Typography variant="body2">
                    <Link
                      to="/faq"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      {" "}
                      click here
                    </Link>
                  </Typography>
                </Box>
              </Grid>
              <Grid
                size={{ xs: 12, md: 4 }}
                display={"flex"}
                justifyContent={"center"}
              >
                <Box>
                  <Typography variant="body1">Contact us </Typography>
                  <Typography variant="body2">Support@Checkme.com</Typography>
                  <Typography variant="body2">0123-456789 or else</Typography>
                  <Typography variant="body2">
                    <Link
                      to="/customersupport"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      {" "}
                      click here
                    </Link>
                  </Typography>
                </Box>
              </Grid>
              <Grid
                size={{ xs: 12, md: 4 }}
                display={"flex"}
                justifyContent={"flex-end"}
              >
                <Box minWidth={220}>
                  <Typography variant="body1">
                    Still have questions ?{" "}
                  </Typography>
                  <Typography variant="body2">Request a demo</Typography>
                  <Typography variant="body2">
                    <Link
                      to="/demo"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      {" "}
                      click here
                    </Link>
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </LightGBox>
        </Box>
      </Box>
    </DarkGBox>
  );
};

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));

const LightGBox = styled(Box)(() => ({
  background: "linear-gradient(108.14deg, rgb(242, 246, 249) 0%, rgb(233, 243, 247) 9.47%, rgb(226, 240, 247) 20.52%, rgb(219, 235, 247) 36.84%, rgb(211, 225, 247) 51.58%, rgb(213, 222, 247) 68.94%, rgb(219, 221, 242) 83.15%, rgb(221, 220, 240) 101.05%);",
}));

const DarkGBox = styled(Box)(() => ({
  background: 'linear-gradient(180deg, #000 0%, #181e4a 35%, #000 100%)',
}));

export default Login;