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
import { useEffect } from "react";
import { useSubscriptionPlans } from "../../context/SubscriptionPlanContext";

export default function PricePlans() {
  const { plans } = useSubscriptionPlans();
  
  // Get plans by name for dynamic pricing
  const starterPlan = plans.find(plan => plan.name === "Starter");
  const growthPlan = plans.find(plan => plan.name === "Growth");
  const professionalPlan = plans.find(plan => plan.name === "Professional");
  
  // Format price helper
  const formatPrice = (price: number | string | null | undefined) => {
    if (price === null || price === undefined) return "0";
    if (typeof price === "string" && price.toLowerCase() === "custom") return "Custom";
    return Number(price).toFixed(2);
  };

  return (
    <>
      <Box
        id="plan-grid"
        display={"flex"}
        flexDirection={"column"}
        justifyContent={"center"}
        alignItems={"center"}
        gap={2}
        color={"#fff"}
        py={5}
        sx={{
         xs: "324px", 
          md: "508px",
        }}
      >
        <Container maxWidth="lg">
          <Box >
            <Grid
             
              container
              rowSpacing={3}
              columnSpacing={{ xs: 2, sm: 2, md: 3 }}
            >
              <Grid item xs={12} md={6} lg={3}  >
                <Box
                
                  px={"20px"}
                  pt={"30px"}
                  pb={"56px"}
                  minHeight={480}
                  border={"solid 1.5px #29277C"}
                  borderRadius={3}
                  sx={{
                    background: {
                      base: "linear-gradient(148.01deg, #172041 64.39%, #1D1C56 38.52%)",
                      md: "linear-gradient(148.01deg, #070417)",
                    },
                   
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
                  <Typography
                    variant="body2"
                    color={"#B9B9B9"}
                    sx={{ height: "35px", overflow: "hidden" }}
                  >
                    Explore risk free for one month
                  </Typography>
                 

                  <Box display={"flex"} alignItems={"center"} gap={1} mt={4}>
                    <Typography
                      variant="h4"
                      fontWeight={600}
                      fontSize={["32px", "36px"]}
                      color="white"
                    >
                      $0 
                    </Typography>
                  </Box>
                  {/* <Typography
                    variant="h4"
                    fontWeight={600}
                    fontSize={["32px", "36px"]}
                    color="white"
                    style={{ opacity: 0.7, marginTop: 0 }}
                  >
                    ₹0
                  </Typography> */}
                  

                  <Typography
                    variant="body2"
                    fontSize="16px"
                    color="rgba(255, 255, 255, 0.6)"
                    mt={0.5}
                  >
                    30 days only
                  </Typography>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      href="/signup"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", 
                        borderColor: "currentColor", 
                        borderRadius: "40px",
                        textTransform: "none",

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
                  border={
                    "solid 1.5px linear-gradient(148.01deg, #4644B3 74.39%, #000000 78.52%) "
                  }
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(148.01deg, #172041 84.39%, #1D1C56 38.52%)",
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

                  <Typography
                    variant="body2"
                    color={"#B9B9B9"}
                    sx={{ height: "35px", overflow: "hidden" }}
                  >
                    Individuals, freelancers, and small service businesses
                  </Typography>

                  
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-start"
                    mt={4}
                  >
                    <Typography
                      variant="h4"
                      fontWeight={600}
                      fontSize={["32px", "36px"]}
                      color="white"
                    >
                      ${formatPrice(starterPlan?.price)} <span style={{ opacity: 0.7 }}></span>
                    </Typography>

                    <Typography
                      variant="body2"
                      fontSize="16px"
                      color="rgba(255, 255, 255, 0.6)"
                      mt={0.5}
                    >
                      per month
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      href="/signup"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", 
                        borderColor: "currentColor", 
                        borderRadius: "40px",
                        textTransform: "none",

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
                      1000 messages per month
                    </Typography>
                  </Box>
                  <Box display={"flex"} my={2}>
                    <Typography
                      variant="body1"
                      fontSize={"14px"}
                      color={"#FFF"}
                    >
                      500 MB storage
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
                  borderRadius={3}
                  sx={{
                    background:
                      "linear-gradient(148.01deg, #6637CC 54.39%, #2E2B9C 78.52%)",
                  }}
                >
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

                  <Typography
                    variant="body2"
                    color={"#B9B9B9"}
                    sx={{ height: "35px", overflow: "hidden" }}
                  >
                    Small to medium businesses and online retailers
                  </Typography>

                 

                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-start"
                    mt={4}
                  >
                    <Typography
                      variant="h4"
                      fontWeight={600}
                      fontSize={["32px", "36px"]}
                      color="white"
                    >
                      ${formatPrice(growthPlan?.price)} <span style={{ opacity: 0.7 }}></span>
                    </Typography>

                    <Typography
                      variant="body2"
                      fontSize="16px"
                      color="rgba(255, 255, 255, 0.6)"
                      mt={0.5}
                    >
                      per month
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      variant="text"
                      href="/signup"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",

                        color: "inherit",
                        border: "1px solid", 
                        borderColor: "currentColor", 
                        borderRadius: "40px",
                        textTransform: "none",

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
                  border={
                    "solid 1.5px  linear-gradient(148.01deg, #4644B3 80.39%, #000000 40.52%) "
                  }
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
                  <Typography
                    variant="body2"
                    color={"#B9B9B9"}
                    sx={{ height: "35px", overflow: "hidden" }}
                  >
                    Established companies & agencies with multiple departments
                  </Typography>
                  <Box
                    display="flex"
                    flexDirection="column"
                    alignItems="flex-start"
                    mt={4}
                  >
                    <Typography
                      variant="h4"
                      fontWeight={600}
                      fontSize={["32px", "36px"]}
                      color="white"
                    >
                      ${formatPrice(professionalPlan?.price)} <span style={{ opacity: 0.7 }}></span>
                    </Typography>

                    <Typography
                      variant="body2"
                      fontSize="16px"
                      color="rgba(255, 255, 255, 0.6)"
                      mt={0.5}
                    >
                      per month
                    </Typography>
                  </Box>

                  <Box display="flex" justifyContent="center" my={3}>
                    <Button
                      href="/signup"
                      variant="text"
                      sx={{
                        width: "230px",
                        height: "50px",
                        padding: "16px 34px",
                        gap: "6px",
                        backgroundColor: "transparent",
                        textTransform: "none",

                        color: "inherit",
                        border: "1px solid", 
                        borderColor: "currentColor", 
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
                      Crawl multiple website
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
                      Powered by Evolra label
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box my={6}>
            <Button
              href="/our-plans#plans-table"
              variant="text"
              sx={{
                width: "100%",
                height: "27px",
                fontSize: "22px",
                textDecoration: "underline",
                fontWeight: 400,
                color: "#FFF",
                textTransform: "none",
                mt: "4px",
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
