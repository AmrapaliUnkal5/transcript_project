import {
  Box,
  Button,
  Container,
  TextField,
  Grid,
  Stack,
  Typography,
  styled,
} from "@mui/material";
import { red } from "@mui/material/colors";
import React from "react";

export default function ConversationForm() {
  return (
    <>
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
        <Container maxWidth="lg">
          <Box
            px={[0, 10]}
            py={[2, 8.85]}
            sx={{
              backgroundImage: "url(/images/title-bg.png)",
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          ></Box>

          <Box>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item xs={12} sm={12} md={6}>
                <Typography
                  variant="h1"
                  fontWeight={600}
                  fontSize={["18px", "40px"]}
                  mt={["35px", "25px"]}
                  mb="23px"
                >
                  Let’s Start A Conversation
                </Typography>
                <Typography
                  variant="body1"
                  fontSize={"16px"}
                  lineHeight={"26px"}
                  color={"#cacaca"}
                  mb={"67px"}
                >
                  Our global support teams operate across the U.S., Europe, the
                  Middle East, and India, ensuring timely, localized assistance
                  tailored to your region and time zone.
                </Typography>

                <Box display={"flex"} mb="31px">
                  <StyledImage
                    src="/images/icon-mail.png"
                    sx={{ width: 28, height: 28, color: "#BAB8FF", mr: 2 }}
                  />
                  <Typography variant="body1" fontSize={16} color={"#cacaca"}>
                    support@evolra.ai
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={6}>
                <Box 

                //  sx={{
                //   background: "linear-gradient(148.01deg, #4644B3 74.39%, #000000 78.52%)", // Gradient border effect
                //  p: "2px" // Border thickness
                //  }}
                >
                <Box 

                //  sx={{
                //        borderRadius: "10px",
                //         background: "linear-gradient(135deg, #BDCCE799 0%, #4C3B941A 50%, #BDCCE799 100%)", // Inner background
                //         }}
                  sx={{
                    maxWidth: 550,
                    mx: "auto",
                    py: 1,
                    pt: 4,
                    borderRadius: "12px",
                    px: "43px",
                    height: "514px",
                    background:
                      "linear-gradient(135deg, #BDCCE799 0%, #4C3B941A 50%, #BDCCE799 100%)",
                  }}
                >
                  <Typography
                    fontSize={"24px"}
                    fontFamily={"instrument sans"}
                    fontWeight={600}
                    gutterBottom
                    mb={"18px"}
                  >
                    Get In Touch
                  </Typography>

                  <Stack spacing={1} mt={"27px"}>
                    <TextField
                      label="Your Name"
                      variant="outlined"
                      fullWidth
                      sx={{
                        backgroundColor: "#070417",
                        borderRadius: "10px",

                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          color: "#fff",
                        },
                        "& .MuiInputLabel-root.Mui-focused": {
                          color: "#ffffff",
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#303030",
                        },
                        "& .MuiInputLabel-root": {
                          color: "#888888",
                        },
                        "& input": {
                          color: "#fff",
                          height: "58px",
                          boxSizing: "border-box",
                          padding: "16.5px 14px",
                        },
                      }}
                    />

                    <TextField
                      label="Email"
                      type="email"
                      fullWidth
                      variant="outlined"
                      sx={{
                        mt: "19px",
                        backgroundColor: "#070417",
                        borderRadius: "10px",
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          color: "#fff",
                        },
                        "& .MuiInputLabel-root.Mui-focused": {
                          color: "#ffffff",
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#303030",
                        },
                        "& .MuiInputLabel-root": {
                          color: "#888888",
                        },
                        "& input": {
                          color: "#fff",
                          height: "58px",
                          boxSizing: "border-box",
                        },
                      }}
                    />

                    <TextField
                      label="Your Message"
                      variant="outlined"
                      multiline
                      rows={4}
                      fullWidth
                      sx={{
                        mt: "19px",
                        backgroundColor: "#070417",
                        borderRadius: "10px",
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "10px",
                          color: "#fff",
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderColor: "#303030",
                        },
                        "& .MuiInputLabel-root.Mui-focused": {
                          color: "#ffffff",
                        },
                        "& .MuiInputLabel-root": {
                          color: "#888888",
                        },
                        "& .MuiInputBase-inputMultiline": {
                          color: "#fff",
                        },
                        "& input": {
                          color: "#fff",
                          height: "58px",
                          boxSizing: "border-box",
                        },
                      }}
                    />

                    <Box pt={4}>
                      <Button
                        variant="contained"
                        sx={{
                          width: 173,

                          height: 52,
                          borderRadius: "40px",
                          background:
                            "linear-gradient(135deg, #F4F4F6 0%, #7C7C7C 100%)",
                          fontSize: "16px",
                          fontWeight: 600,
                          fontFamily: "Instrument Sans",
                          color: "black",
                          padding: 0, 
                          minWidth: 0,
                          textTransform: "none", 
                        }}
                      >
                        Submit
                      </Button>
                    </Box>
                  </Stack>
                </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>
    </>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
