import { Box, Fab, styled } from "@mui/material";
import {
  Button,
  Container,
  TextField,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import React from "react";

export default function Location() {
  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      justifyContent={"center"}
      alignItems={"center"}
      gap={2}
      color={"#fff"}
      px={2}
      py={2} //5
      sx={{ backgroundColor: "#101035" }}
    >
      <Typography
        variant="h1"
        fontWeight={600}
        fontSize={["18px", "40px"]}
        mt={["35px", "25px"]}
      >
        We Are Located At
      </Typography>

      <Container maxWidth="lg">
        <Box
          px={[0, 10]}
          py={[2, 4]}
          sx={{
            backgroundImage: "url(/images/title-bg.png)",
            backgroundSize: "contain",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {" "}
        </Box>

        <Box>
          <Grid
            container
            rowSpacing={[3]}
            columnSpacing={{ xs: 2, sm: 2, md: 3 }}
          >
            <Grid item xs={12} sm={12} md={6}>
              <Box
                sx={{
                  mx: "auto",
                  pt: 1.5,
                  border: "1.5px ",
                  borderRadius: "22px",
                    height: {
                    md: 460, },
                  background:
                    "linear-gradient(135deg, #BDCCE799 0%, #47359014 100%)",
                  pb: 3,
                }}
              >
                <Box mx={2}>
                  <StyledImage
                    src="/images/Contact/NewYork.png"
                    sx={{
                      width: "100%",
                      maxHeight: 363,
                      color: "#BAB8FF",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "scale(1.01)",
                        boxShadow: "0 8px 20px rgba(84, 71, 157, 0.2)",
                      },
                    }}
                  />
                </Box>
                <Typography
                  variant="body1"
                  mt={3}
                  mb={4}
                  color="white"
                  ml={1.5}
                  fontFamily={"instrument sans"}
                  fontSize={"20px"}
                  fontWeight={600}
                  lineHeight={"30px"}
                >
                  Charlotte, NC, USA
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <Box
                sx={{
                  mx: "auto",
                  pt: 1.5,
                  border: "1.5px ",
                  borderRadius: "22px",
                    height: {
                    md: 460, },
                  background:
                    "linear-gradient(135deg, #BDCCE799 0%, #47359014 100%)",
                  pb: 3,
                }}
              >
                <Box mx={2}>
                  <StyledImage
                    src="/images/Contact/MuscatOman.png"
                    sx={{
                      width: "100%",
                      maxHeight: 363,
                      color: "#BAB8FF",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "scale(1.01)",
                        boxShadow: "0 8px 20px rgba(84, 71, 157, 0.2)",
                      },
                    }}
                  />
                </Box>
                <Typography
                  variant="body1"
                  mt={3}
                  mb={4}
                  color="white"
                  ml={1.5}
                  fontFamily={"instrument sans"}
                  fontSize={"20px"}
                  fontWeight={600}
                  lineHeight={"30px"}
                >
                  Muscat, Oman
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <Box
                sx={{
                  mx: "auto",
                  pt: 1.5,
                  border: "1.5px ",
                  borderRadius: "22px",
                  height: {
                    md: 460, },
                  background:
                    "linear-gradient(135deg, #BDCCE799 0%, #47359014 100%)",
                  pb: 3,
                }}
              >
                <Box mx={2}>
                  <StyledImage
                    src="/images/Contact/Jaipur.png"
                    sx={{
                      width: "100%",
                      maxHeight: 363,
                      color: "#BAB8FF",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "scale(1.01)",
                        boxShadow: "0 8px 20px rgba(84, 71, 157, 0.2)",
                      },
                    }}
                  />
                </Box>
                <Typography
                  variant="body1"
                  mt={3}
                  mb={4}
                  color="white"
                  ml={1.5}
                  fontFamily={"instrument sans"}
                  fontSize={"20px"}
                  fontWeight={600}
                  lineHeight={"30px"}
                >
                  Jaipur, India
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <Box
                sx={{
                  mx: "auto",
                  pt: 1.5,
                  border: "1.5px ",
                  borderRadius: "22px",
                    height: {
                    md: 460, },
                  background:
                    "linear-gradient(135deg, #BDCCE799 0%, #47359014 100%)",
                  pb: 3,
                }}
              >
                <Box mx={2}>
                  <StyledImage
                    src="/images/Contact/Dubai.png"
                    sx={{
                      width: "100%",
                      maxHeight: 363,
                      maxWidth: "100%",
                      color: "#BAB8FF",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "scale(1.01)",
                        boxShadow: "0 8px 20px rgba(84, 71, 157, 0.2)",
                      },
                    }}
                  />
                </Box>
                <Typography
                  variant="body1"
                  mt={3}
                  mb={4}
                  color="white"
                  ml={1.5}
                  fontFamily={"instrument sans"}
                  fontSize={"20px"}
                  fontWeight={600}
                  lineHeight={"30px"}
                >
                  Dubai, UAE
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={12} md={6}>
              <Box
                sx={{
                  mx: "auto",
                  pt: 1.5,
                  border: "1.5px ",
                  borderRadius: "22px",
                    height: {
                    md: 460, },
                  background:
                    "linear-gradient(135deg, #BDCCE799 0%, #47359014 100%)",
                  pb: 3,
                }}
              >
                <Box mx={2}>
                  <StyledImage
                    src="/images/Contact/Berlin.png"
                    sx={{
                      width: "100%",
                      maxHeight: 363,
                      maxWidth: "100%",
                      color: "#BAB8FF",
                      transition: "all 0.2s ease",
                      "&:hover": {
                        transform: "scale(1.01)",
                        boxShadow: "0 8px 20px rgba(84, 71, 157, 0.2)",
                      },
                    }}
                  />
                </Box>
                <Typography
                  variant="body1"
                  mt={3}
                  mb={4}
                  color="white"
                  ml={1.5}
                  fontFamily={"instrument sans"}
                  fontSize={"20px"}
                  fontWeight={600}
                  lineHeight={"30px"}
                >
                  Berlin, Germany
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
