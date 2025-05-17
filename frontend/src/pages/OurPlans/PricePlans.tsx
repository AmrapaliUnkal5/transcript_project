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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

export default function PricePlans() {
  return (
    <>
      <Box
        display={"flex"}
        flexDirection={"column"}
        justifyContent={"center"}
        alignItems={"center"}
        gap={2}
        color={"#fff"}
        py={5}
        sx={{
          backgroundColor: "#101035",
          xs: "324px", // phones
          md: "508px",
        }}
      >
        <Container maxWidth="lg">
          <Box>
            <Grid
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item xs={12} md={6} lg={3}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"56px"}
                  minHeight={480}
                  border={"solid 1.5px #29277C"}
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
                    lineHeight="32px"
                    mb={1}
                  >
                    Free
                  </Typography>
                  <Typography variant="body2" color={"#B9B9B9"}>
                    Explore risk free for one month
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={6}>
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize={["32px", "42px"]}
                      lineHeight={1.5}
                      mb={1}
                    >
                      $14.99
                    </Typography>
                    <Typography variant="h6" fontWeight={"400"}>
                      {" "}
                      /month
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",

                        mb: 4,
                      }}
                    >
                      Get started
                    </Button>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      1 AI Chatbot
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Crawl 1 website
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      100 messages for 30 days
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      20 MB storage
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontWeight={400}
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      50K word count for knowledge base
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Basic UI customization
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Powered by Evolra label
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6} lg={3}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"56px"}
                  minHeight={480}
                  border={"solid 1.5px #29277C"}
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
                    lineHeight="32px"
                    mb={1}
                  >
                    Starter
                  </Typography>

                  <Typography variant="body2" color={"#B9B9B9"} noWrap>
                    For individuals and small businesses
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={6}>
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize={["32px", "42px"]}
                      lineHeight={1.5}
                      mb={1}
                    >
                      $14.99
                    </Typography>
                    <Typography variant="h6" fontWeight={"400"}>
                      {" "}
                      /month
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",

                        mb: 4,
                      }}
                    >
                      Choose plan
                    </Button>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      1 AI Chatbot
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Crawl 1 website
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      1500 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      1 GB storage
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontWeight={400}
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      1 million word count for knowledge base
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Full UI customization
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Powered by Evolra label
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6} lg={3}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"56px"}
                  minHeight={480}
                  border={"solid 1.5px "}
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(148.01deg, #6637CC 54.39%, #2E2B9C 78.52%)",
                  }}
                >
                  {/* <Typography
                    variant="h3"
                    fontWeight={600}
                    fontSize={"22px"}
                    lineHeight="32px"
                    mb={1}
                  >
                    Growth
                  </Typography> */}

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize="22px"
                      lineHeight="32px"
                    >
                      Growth
                    </Typography>

                    <Box
                      sx={{
                        backgroundColor: "#ffffff",
                        color: "#2E2B9C",
                        fontWeight: 600,
                        fontSize: "12px",
                        width: "88px",
                        height: "29px",
                        px: "6px",
                        py: "2px",
                        borderRadius: "30px",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      POPULAR
                    </Box>
                  </Box>

                  <Typography variant="body2" color={"#B9B9B9"}>
                    For startups and small businesses
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={6}>
                    <Typography
                      variant="h3"
                      fontWeight={600}
                      fontSize={["32px", "42px"]}
                      lineHeight={1.5}
                      mb={1}
                    >
                      $24.99
                    </Typography>
                    <Typography variant="h6" fontWeight={"400"}>
                      {" "}
                      /month
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",

                        mb: 4,
                      }}
                    >
                      Choose plan
                    </Button>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      2 AI Chatbot
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Crawl 2 website
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      2500 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      1 GB storage
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontWeight={400}
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      2 million word count for knowledge base
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Full UI customization
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Powered by Evolra label
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <Box
                  px={"20px"}
                  pt={"30px"}
                  pb={"56px"}
                  minHeight={480}
                  border={"solid 1.5px #29277C"}
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
                    lineHeight="32px"
                    mb={1}
                  >
                    Professional
                  </Typography>
                  <Typography variant="body2" color={"#B9B9B9"}>
                    For growing businesses
                  </Typography>

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={6}>
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

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", // 1px solid border
                        borderColor: "currentColor", // border color same as text color
                        borderRadius: "40px",

                        mb: 4,
                      }}
                    >
                      Choose plan
                    </Button>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      5 AI Chatbot
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Crawl 5 website
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      6000 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      5 GB storage
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontWeight={400}
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      5 million word count for knowledge base
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      Full UI customization
                    </Typography>
                  </Box>

                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      No Evolra label
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box my={6}>
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
              Compare all features{" "}
              <KeyboardArrowDownIcon
                sx={{
                  marginLeft: "10px",
                  width: "22px",
                  height: "22px",
                  fontWeight: 400,
                }}
              />
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
