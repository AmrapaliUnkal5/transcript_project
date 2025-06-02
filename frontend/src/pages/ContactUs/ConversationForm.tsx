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
            py={[2,8.85]}
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
                  mt={["35px","25px"]}
                  mb="23px"
                >
                  Let’s Start A Conversation
                </Typography>
                <Typography variant="body1" fontSize={"16px"} lineHeight={"26px"} color={"#cacaca"} mb={"67px"}>
                  Our global support teams operate across the U.S., Europe, the
                  Middle East, and India, ensuring timely, localized assistance
                  tailored to your region and time zone.
                </Typography>
              
                <Box display={"flex"} mb="31px">
                  <StyledImage
                    src="/images/icon-call.png"
                    sx={{ width: 28, height: 28, color: "#BAB8FF",mr:2}}
                  />
                  <Typography variant="body1" fontSize={16} color={"#cacaca"}>
                    978974574
                  </Typography>
                </Box>
                <Box display={"flex"}  mb="31px">
                  <StyledImage
                    src="/images/icon-mail.png"
                    sx={{ width: 28, height: 28, color: "#BAB8FF",mr:2 }}
                  />
                  <Typography variant="body1"  fontSize={16} color={"#cacaca"}>
                    mail@evolra.ai
                  </Typography>
                </Box>
                <Box 
                display={{ xs: "none", md: "flex" }} mb={3}>
                  <StyledImage
                    src="/images/icon-location-on.png"
                    sx={{ width: 28, height: 28, color: "#BAB8FF",mr:2 }}
                  />

                  <Typography variant="body1" fontSize={"16px"} color={"#cacaca"}>
                    202 Helga Springs Rd, Crawford, IN, 38554
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={6}>
                <Box
                  sx={{
                    maxWidth: 550,
                    mx: "auto",
                    py:1,
                    pt:4,
                    border: "1.5px ",
                    px:"43px",
                    height:"582px",
                    backgroundColor: "#1E1A35",
                    borderRadius: "20px",
                    borderColor: "#28284B",
                    boxShadow: 3,
                  }}
                >
                  <Typography variant="h5" fontWeight="bold" gutterBottom mb={"18px"}>
                    Get In Touch
                  </Typography>
                  <Typography variant="body1" color="white" gutterBottom>
                    You can reach us anytime.
                  </Typography>

                  <Stack spacing={1} mt={"41px"}>
                    <TextField
                      label="Your Name"
                      
                      fullWidth
                      sx={{
                        backgroundColor: "#070417",
                        borderRadius: "10px",
                        borderWidth:1,
                        borderColor: "#303030",
                        
                        height:"58px",
                        input: { color: "#fff" },
                         label: { color: "#888888" },
                      }}
                    />
                    <TextField
                      label="Email"
                      type="email"
                      variant="outlined"
                      fullWidth
                      sx={{
                        mt:"19px",
                        backgroundColor: "#070417",
                        borderRadius: "10px",
                        borderWidth:1,
                        borderColor: "#303030",
                      
                        height:"58px",
                        input: { color: "#fff" },
                         label: { color: "#888888" },
                      }}
                    />
                    <TextField
                      label="Your Message"
                      variant="outlined"
                      
                      multiline
                      rows={4}
                      fullWidth
                       sx={{
                        mt:"19px",
                        backgroundColor: "#070417",
                        borderRadius: "10px",
                        borderWidth:"1px",
                        borderColor: "#303030",
                        
                        height:"136px",
                        input: { color: "#fff" },
                         label: { color: "#888888" },
                      }}
                    />
                    <Box pt={4} >
                    <Button
                      variant="contained"
                      sx={{
                        width: 173,
                     
                        height: 52,
                        borderRadius: "40px",
                        background:
                          "linear-gradient(180deg, #5A6CF2 0%, #4B3498 100%)",
                        color: "#fff",
                        padding: 0, // remove any default padding that may affect shape
                        minWidth: 0, 
                        textTransform: "none",// ensures the width stays exactly 173px
                      }}
                    >
                      Submit
                    </Button>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            </Grid>
          </Box>
          {/* <Box display={"flex"} justifyContent={"center"} my={2}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                borderRadius: "40px",
                height: "62px",
                minWidth: "220px",
                textTransform: "capitalize",
                background:
                  "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%);",
              }}
            >
              Get started for free
            </Button>
          </Box> */}
        </Container>
      </Box>
    </>
  );
}

const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
