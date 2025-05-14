import React from "react";
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
          </Grid>
          <Grid item xs={6} sm={6} md={2}>
            <Box display={"flex"} flexDirection={"column"} gap={2}>
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
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <Typography
              sx={{
                fontSize: "16px",

                color: "#6B6B6B",
              }}
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
