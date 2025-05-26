import React from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
  Link,
  Divider,
} from "@mui/material";

function Footer() {
  return (
    <Box
      px={4}
      pb={3}
      sx={{
        backgroundColor: "#101035",
      }}
    >
      <Box>
        <Grid container rowSpacing={4} columnSpacing={{ xs: 2, sm: 2, md: 2 }}>
          <Grid item xs={12} sm={12} md={4}>
            <Box>
              <StyledImage
                src="/images/logo.png"
                sx={{ width: "244px", height: "38px" }}
              />
              {/* Adjust the size of the image */}
            </Box>
          </Grid>
          <Grid item xs={6} sm={6} md={2}>
            <Box display={"flex"} flexDirection={"column"} gap={2}>
              <RouterLink
                to="/our-plans"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                Our plans
              </RouterLink>

              {/* <Link href="#" color="#ffffff" underline="hover">
                Our plans
              </Link> */}
              <Link href="#" color="#ffffff" underline="hover">
                Our services
              </Link>
              <Link href="#" color="#ffffff" underline="hover">
                About Us
              </Link>
              <RouterLink
                to="/data-deletion"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                Data deletion
              </RouterLink>
            
            </Box>
          </Grid>
          <Grid item xs={6} sm={6} md={2}>
            <Box display={"flex"} flexDirection={"column"} gap={2}>
               <RouterLink
                to="/faq-page"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                FAQs
              </RouterLink>
             <RouterLink
                to="/privacy-policy"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                Privacy Policy
              </RouterLink>
               <RouterLink
                to="/contact-us"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                Contact Us
              </RouterLink>
              <RouterLink
                to="/terms-of-service"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                Terms of Service
              </RouterLink>
            </Box>
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <Typography
              fontSize={"16px"}
              color="#6B6B6B "
              textAlign={["left", "center"]}
            >
              hello@evolra.ai
            </Typography>
          </Grid>
        </Grid>

        <Box mt={5} mb={3}>
          <Divider sx={{ backgroundColor: "#ffffff", opacity: 0.1 }} />
        </Box>
        <Typography
          sx={{
            fontSize: "16px",
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          © 2025 Evolra. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}

export default Footer;

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
