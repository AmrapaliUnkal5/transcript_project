import React from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
  Link,Divider,
} from "@mui/material";

function Footer() {
  return (
    <Box
      sx={{
        backgroundColor: "#101035", 
        color: "#fff", // White text
        position: "relative", 
        height: "283px"
      }}
    >
        <Box >
        

        </Box>

        <Box
    sx={{
      position: "absolute",
      left: "10px", // Adjust position from left side
      top: "41px", // Keep top positioning to align with other elements
    }}
  >
    <img src="/images/Evolra-AI-Logo.png" alt="Company Logo" style={{top:'45px',left:'46px', width: '244px', height: '50px' }} /> {/* Adjust the size of the image */}
  </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "17px", // Gap between links
              fontSize: "16px",
              position: "absolute",
              transform: "translateX(-50%)",
              top: "41px",
              bottom: "131px",
              lineHeight: "26px",
              right: "715px",
              fontWeight: 400,
              textAlign: "center", // Center the text for links
            }}
          >
            <Link href="#" color="#ffffff" underline="hover">
              Our plans
            </Link>
            <Link href="#" color="#ffffff" underline="hover">
              Our services
            </Link>
            <Link href="#" color="#ffffff" underline="hover">
              About Us
            </Link>
          </Box>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              position: "absolute",
              transform: "translateX(-50%)",
              gap: "17px", 
              fontSize: "16px",
              lineHeight: "26px",
              top:'41px',
              bottom:'133px',
              right:'487px',
            }}
          >
            <Link href="#" color="#ffffff" underline="hover">
              FAQs
            </Link>
            <Link href="#" color="#ffffff" underline="hover">
              Privacy Policy
            </Link>
            <Link href="#" color="#ffffff" underline="hover">
              Contact Us
            </Link>
          </Box>
       

      <Typography
        sx={{
          position: "absolute",
          right: "126px", 
          top: "41px", 
          fontSize: "16px",
           lineHeight: "26px", 
          color: "#6B6B6B",
        }}
      >
        hello@evolra.ai
      </Typography>

<Box
    sx={{
      width: "100%",
      position: "absolute",
      bottom: "81px", 
      color:"#323232"   
    }}
  >
    <Divider sx={{ backgroundColor: "#ffffff", opacity: 0.1 }} />
  </Box>
<Typography
        sx={{
          position: "absolute",
          bottom: "39px", 
          fontSize: "16px",
          color: "#ffffff",
          right:'600px'
        }}
      >
        © 2025 Evolra. All rights reserved.
      </Typography>

      
    </Box>
  );
}

export default Footer;
