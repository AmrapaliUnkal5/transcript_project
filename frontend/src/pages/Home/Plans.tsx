import {
  Box,
  Button,
  Container,
  Divider,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EastOutlinedIcon from "@mui/icons-material/EastOutlined";

export default function Plans() {
  return (
    <>
      <Box
        display={"flex"}
        flexDirection={"column"}
        justifyContent={"center"}
        alignItems={"center"}
        gap={2}
        color={"#fff"}
        px={[1,2]}
        py={5}
        sx={{ backgroundColor: "#101035" }}
      >
        <Container maxWidth="lg">
          <Box
            px={[1, 10]}
            pt={[4, 7]}
            pb={[2, 7]}
            sx={{
              backgroundImage: "url(/images/title-bg.png)",
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            <Typography
              variant="h2"
              fontWeight={600}
              fontSize={["30px", "54px"]}
              sx={{
                background: "-webkit-linear-gradient(#FFF, #959595)",
                backgroundClip: "text",
                textFillColor: "transparent",
                pb:[2,0]
              }}
              textAlign={"center"}
              textTransform="none"
              
            >
              Choose your plan
            </Typography>
          </Box>

          <Box display={"flex"} justifyContent={"center"} mt={0} mb={[3.5,10]}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              sx={{
                paddingLeft: "5%",
                paddingRight: "5%",
                fontSize: ["14px", "18px"],
                fontWeight: 400,
                borderRadius: "40px",
                height: ["56px", "67px"],
                minWidth: "320px",
                textTransform: "none",
                background:
                  "linear-gradient(148.01deg, #25356F 54.39%, #1D1C56 78.52%)",
                border: "1.5px solid",
                borderImageSource:
                  "linear-gradient(143.63deg, rgba(234, 234, 234, 0.3) 12.75%, rgba(86, 86, 86, 0.3) 88.18%)",
              }}
            >
              Try Evolra with our free plan{" "}
              <EastOutlinedIcon sx={{ marginLeft: "10px" }} />
            </Button>
          </Box>

          <Box>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item xs={12} sm={6} md={4}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"20px"}
                  minHeight={480}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(148.01deg, #172041 54.39%, #1D1C56 78.52%)",
                  }}
                >
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={"22px"}
                    lineHeight={1.5}
                    mb={1}
                  >
                    Starter
                  </Typography>
                  <Typography variant="body2" color={"#B9B9B9"} fontSize={"14px"}>
                    For individuals and small businesses
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={3}>
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize={["40px", "43px"]}
                      lineHeight={1.5}
                      mb={1}
                    >
                      $14.99
                    </Typography>
                    <Typography variant="h6" fontWeight={"400"} fontSize={["16px","20px"]}>
                      {" "}
                      /month
                    </Typography>
                  </Box>

                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF"  , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      1 AI Chatbot
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"] }} />
                    <Typography variant="body1" color={"#FFF"}  fontSize={["14px","16px"]}>
                      Crawl 1 website
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF"  , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF" }  fontSize={["14px","16px"]}>
                      1500 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"}  fontSize={["14px","16px"]}>
                      1 GB storage
                    </Typography>
                  </Box>

                  <Divider sx={{ borderBottom: "1px solid #4F5697", mt: 8 }} />
                  <Button
                    variant="text"
                    sx={{
                      width: "100%",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#FFF",
                      textTransform: "capitalize",
                      mt: 2,
                    }}
                  >
                    Choose plan <EastOutlinedIcon sx={{ marginLeft: "10px" }} />
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"20px"}
                  minHeight={480}
                  border={"solid 1px transparent"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(148.01deg, #6637CC 19.99%, #2E2B9C 73.01%)",
                  }}
                >
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["22px"]}
                    lineHeight={1.5}
                    mb={1}
                  >
                    Growth
                  </Typography>
                  <Typography variant="body2" color={"#B9B9B9"} fontSize={["14px"]}>
                    For startups and small businesses
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={3}>
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize={["40px", "43px"]}
                      lineHeight={1.5}
                      mb={1}
                    >
                      $24.99
                    </Typography>
                    <Typography variant="h6" fontWeight={"400"} fontSize={["16px","20px"]}>
                      {" "}
                      /month
                    </Typography>
                  </Box>

                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      2 AI chatbots
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      Crawl 2 website
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      2500 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"] }} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      1 GB storage
                    </Typography>
                  </Box>

                  <Divider sx={{ borderBottom: "1px solid #4F5697", mt: 8 }} />
                  <Button
                    variant="text"
                    sx={{
                      width: "100%",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#FFF",
                      textTransform: "capitalize",
                      mt: 2,
                    }}
                  >
                    Choose plan <EastOutlinedIcon sx={{ marginLeft: "10px" }} />
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={4}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"20px"}
                  minHeight={480}
                  border={"solid 1px #8B96D661"}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(148.01deg, #172041 54.39%, #1D1C56 78.52%)",
                  }}
                >
                  <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={["18px", "24px"]}
                    lineHeight={1.5}
                    mb={1}
                  >
                    Professional
                  </Typography>
                  <Typography variant="body2" color={"#B9B9B9"}>
                    For startups and small businesses
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={3}>
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize={["32px", "42px"]}
                      lineHeight={1.5}
                      mb={1}
                    >
                      $54.99
                    </Typography>
                    <Typography variant="h6" fontWeight={"400"}>
                      {" "}
                      /month
                    </Typography>
                  </Box>

                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      5 AI chatbots
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"] }} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      Crawl 5 websites
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF" , width: ["22px", "24px"],
    height: ["22px", "24px"] }} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      6000 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} gap={1} my={2}>
                    <CheckCircleIcon sx={{ color: "#BAB8FF"  , width: ["22px", "24px"],
    height: ["22px", "24px"]}} />
                    <Typography variant="body1" color={"#FFF"} fontSize={["14px","16px"]}>
                      5 GB storage
                    </Typography>
                  </Box>

                  <Divider sx={{ borderBottom: "1px solid #4F5697", mt: 8 }} />
                  <Button
                    variant="text"
                    sx={{
                      width: "100%",
                      fontSize: "18px",
                      fontWeight: 600,
                      color: "#FFF",
                      textTransform: "capitalize",
                      mt: 2,
                    }}
                  >
                    Choose plan <EastOutlinedIcon sx={{ marginLeft: "10px" }} />
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box mt={[0,3]}>
            <Button
              variant="text"
              sx={{
                width: "100%",
                fontSize: "18px",
                textDecoration: "underline",
                fontWeight: 400,
                color: "#FFF",
                textTransform: "none",
                mt: 2,
              }}
            >
              Compare all plans <EastOutlinedIcon sx={{ marginLeft: "10px" }} />
            </Button>
          </Box>
        </Container>
      </Box>
    </>
  );
}

const StyledImage = styled("img")(() => ({
  width: "100%",
  maxHeight: "100%",
}));
