import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import React from "react";
import { useAddonPlans } from "../../context/SubscriptionPlanContext";

export default function AddonExperience() {
  const { addons } = useAddonPlans();

  const Multilingual_support = addons.find(addon => addon.name === "Multilingual Support");
  const White_Labeling = addons.find(addon => addon.name === "White-Labeling");
  const Additional_messages = addons.find(addon => addon.name === "Additional Messages");
  const Additional_word_capacity=addons.find(addon => addon.name === "Additional Word Capacity");
  const Additional_Ai_admin_users=addons.find(addon => addon.name === "Additional AI Admin Users");


  // Format price helper
  const formatPrice = (price: number | string | null | undefined) => {
    if (price === null || price === undefined) return "0";
    if (typeof price === "string" && price.toLowerCase() === "custom") return "Custom";
    return Number(price).toFixed(2);
  };

  return (
    <Box
      display={"flex"}
      flexDirection={"column"}
      justifyContent={"center"}
      alignItems={"center"}
      gap={2}
      color={"#fff"}
      px={[1,2]}
      sx={{ backgroundColor: "#101035" }}
    >
      <Container maxWidth="lg">
        <Box
          px={[1, 10]}
          py={[2, 10]}
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
            rowSpacing={5}
            columnSpacing={{ xs: 2, sm: 2, md: 2 }}
          >
            <Grid item  xs={12} sm={12} md={4} textAlign={["center", "left"]}>
              <Box
                px={2}
                py={3}
                sx={{
                  background:
                    "linear-gradient(135deg, #54479D99 0%, #47359014 100%)",
                  borderWidth: 1,
                  borderColor: "#8B96D661",

                  borderRadius: "12px",
                  // width: "364px",
                  // height: "407px",
                }}
              >
                <StyledImage
                  src="/images/icons/icon-rectangle-v.png"
                  sx={{
                    width: "63px",
                    height: "63px",
                    margin: ["auto", "unset"],
                  }}
                />

                <Typography
                  variant="h3"
                  fontWeight={600}
                  fontSize={["20px", "22px"]}
                  mb={2}
                  mt={[3, 5]}
                  lineHeight={1.4}
                >
                  Multilingual Support
                </Typography>

                <Typography
                  variant="body1"
                  color={"#9F9F9F"}
                  sx={{
                    fontSize: ["14px", "16px"],
                  }}
                  minHeight={128}
                >
                  Expand your bot's language capabilities to serve customers
                  globally. 
                </Typography>

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  width="100%"
                >
                  
                    <Box display={"flex"} alignItems={"center"} gap={1}>
                     

                       <Typography
                       variant="h6"
                      fontWeight={600}
                      fontSize="20px"
                      lineHeight={1.5}
                      mb={1}
                         >
                       ${formatPrice(Multilingual_support?.price)} 
                     </Typography>

                  <Typography
                      variant="h6"
                      fontWeight={"400"}
                      fontSize={"14px"}
                    >
                      /month
                    </Typography>
                    </Box>

                    <Button
                  href="/signup"
                    sx={{
                     background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
                      color: "#363637",
                      textTransform: "none",
                      borderRadius: "20px",
                      fontSize: "16px",
                      px: 3,
                      width: "96px",
                      height: "52px",
                    }}
                  >
                    Get
                  </Button>
                  </Box>
                </Box>
              
            </Grid>

            <Grid item   xs={12} sm={12} md={4} textAlign={["center", "left"]}>
              <Box
                px={2}
                py={3}
                sx={{
                  background:
                    "linear-gradient(135deg, #54479D99 0%, #47359014 100%)",
                  borderWidth: 1,
                  borderColor: "#8B96D661",
                  borderRadius: "12px",
                  // px: 2,
                  // py: 3,
                }}
              >
                <StyledImage
                  src="/images/icons/icon-rectangle-v.png"
                  sx={{
                    width: "63px",
                    height: "63x",
                    margin: ["auto", "unset"],
                  }}
                />

                <Typography
                  variant="h3"
                  fontWeight={600}
                  fontSize={["20px", "22px"]}
                  mt={[3, 5]}
                  mb={2}
                  lineHeight={1.4}
                >
                  White-Labeling
                </Typography>

                <Typography
                  variant="body1"
                  color={"#9F9F9F"}
                  sx={{
                    fontSize: ["14px", "16px"],
                  }}
                  minHeight={128}
                >
                  Remove the "Powered by Evolra AI" branding from your widget
                  for a completely seamless brand experience 
                </Typography>

                <Box
                  display={"flex"}
                  alignItems={"center"}
                  gap={1}
                  justifyContent={"space-between"}
                >
                  
                  <Box display={"flex"} alignItems={"center"} gap={1}>
                       <Typography
                      variant="h6"
                      fontWeight={600}
                      fontSize="20px"
                      lineHeight={1.5}
                      mb={1}
                       >
                      ${formatPrice(White_Labeling?.price)} 
                      </Typography>

                    <Typography
                      variant="h6"
                      fontWeight={"400"}
                      fontSize={"14px"}
                    >/month
                    </Typography>
             </Box>
                  <Button
                  href="/signup"
                    sx={{
                     background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
                      color: "#363637",
                      textTransform: "none",
                      borderRadius: "20px",
                      fontSize: "16px",
                      px: 3,
                      width: "96px",
                      height: "52px",
                    }}
                  >
                    Get
                  </Button>
                </Box>
              </Box>
            </Grid>

            <Grid item   xs={12} sm={12} md={4} textAlign={["center", "left"]}>
              <Box
                sx={{
                  background:
                    "linear-gradient(135deg, #54479D99 0%, #47359014 100%)",

                  borderRadius: "12px",
                  borderWidth: 1,
                  borderColor: "#8B96D661",
                  px: 2,
                  py: 3,
                }}
              >
                <StyledImage
                  src="/images/icons/icon-rectangle-v.png"
                  sx={{
                    width: "63px",
                    height: "63px",

                    margin: ["auto", "unset"],
                  }}
                />

                <Typography
                  variant="h3"
                  fontWeight={600}
                  fontSize={["20px", "22px"]}
                  mb={2}
                  mt={[3, 5]}
                  lineHeight={1.4}
                >
                  Additional Messages
                </Typography>

                <Typography
                  variant="body1"
                  color={"#9F9F9F"}
                  sx={{
                    fontSize: ["14px", "16px"],
                  }}
                  minHeight={128}
                >
                  Add 1,000 extra AI messages to your monthly quota.
                </Typography>

                <Box
                  display={"flex"}
                  alignItems={"center"}
                  gap={1}
                  justifyContent={"space-between"}
                >
                  <Box display={"flex"} alignItems={"center"} gap={1}>
                    

                    <Typography
                       variant="h6"
                       fontWeight={600}
                      fontSize="20px"
                       lineHeight={1.5}
                      mb={1}
                           >
                      {/* $9.99 / ₹850 */}
                       ${formatPrice(Additional_messages?.price)} 
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight={"400"}
                      fontSize={"14px"}
                    >
                      /month
                    </Typography>
                  </Box>
                <Button
                  href="/signup"
                    sx={{
                     background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
                      color: "#363637",
                      textTransform: "none",
                      borderRadius: "20px",
                      fontSize: "16px",
                      px: 3,
                      width: "96px",
                      height: "52px",
                    }}
                  >
                    Get
                  </Button>
                </Box>
              </Box>
            </Grid>

            <Grid item  xs={12} sm={12} md={4} textAlign={["center", "left"]}>
              <Box
                px={2}
                py={3}
                sx={{
                  background:
                    "linear-gradient(135deg, #54479D99 0%, #47359014 100%)",
                  borderWidth: 1,
                  borderColor: "#8B96D661",

                  borderRadius: "12px",
                  // width: "364px",
                  // height: "407px",
                }}
              >
                <StyledImage
                  src="/images/icons/icon-rectangle-v.png"
                  sx={{
                    width: "63px",
                    height: "63px",
                    margin: ["auto", "unset"],
                  }}
                />

                <Typography
                  variant="h3"
                  fontWeight={600}
                  fontSize={["20px", "22px"]}
                  mb={2}
                  mt={[3, 5]}
                  lineHeight={1.4}
                >
                  Additional Word Capacity
                </Typography>

                <Typography
                  variant="body1"
                  color={"#9F9F9F"}
                  sx={{
                    fontSize: ["14px", "16px"],
                  }}
                  minHeight={128}
                >
                  Expand your knowledge base withan additional 1 million grounded words.
                </Typography>

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  width="100%"
                >
                  

                <Box display={"flex"} alignItems={"center"} gap={1}>
                       <Typography
                     variant="h6"
                    fontWeight={600}
                    fontSize="20px"
                    lineHeight={1.5}
                    mb={1}
                    >
                  {/* $5/ ₹450 */}
                  ${formatPrice(Additional_word_capacity?.price)} 
                </Typography>

               <Typography
                      variant="h6"
                      fontWeight={"400"}
                      fontSize={"14px"}>/month
                    </Typography></Box>
                 
                 <Button
                  href="/signup"
                    sx={{
                     background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
                      color: "#363637",
                      textTransform: "none",
                      borderRadius: "20px",
                      fontSize: "16px",
                      px: 3,
                      width: "96px",
                      height: "52px",
                    }}
                  >
                    Get
                  </Button>

                   
                  </Box>
                </Box>
              
            </Grid>


            <Grid item  xs={12} sm={12} md={4} textAlign={["center", "left"]}>
              <Box
                px={2}
                py={3}
                sx={{
                  background:
                    "linear-gradient(135deg, #54479D99 0%, #47359014 100%)",
                  borderWidth: 1,
                  borderColor: "#8B96D661",

                  borderRadius: "12px",
                  // width: "364px",
                  // height: "407px",
                }}
              >
                <StyledImage
                  src="/images/icons/icon-rectangle-v.png"
                  sx={{
                    width: "63px",
                    height: "63px",
                    margin: ["auto", "unset"],
                  }}
                />

                <Typography
                  variant="h3"
                  fontWeight={600}
                  fontSize={["20px", "22px"]}
                  mb={2}
                  mt={[3, 5]}
                  lineHeight={1.4}
                >
                 Additional AI Admin Users
                </Typography>

                <Typography
                  variant="body1"
                  color={"#9F9F9F"}
                  sx={{
                    fontSize: ["14px", "16px"],
                  }}
                  minHeight={128}
                >
                 Add more Admin users to manage your Bots and knowledge base.
                </Typography>

                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  width="100%"
                >
                  
                   

                    <Box display={"flex"} alignItems={"center"} gap={1}>
                       <Typography
                      variant="h6"
                      fontWeight={600}
                      fontSize="20px"
                      lineHeight={1.5}
                      mb={1}
                       >
                      ${formatPrice(Additional_Ai_admin_users?.price)} 
                     </Typography>

                  <Typography
                      variant="h6"
                      fontWeight={"400"}
                      fontSize={"14px"}>/month
                    </Typography></Box>

                   <Button
                  href="/signup"
                    sx={{
                     background: 'linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)',
                      color: "#363637",
                      textTransform: "none",
                      borderRadius: "20px",
                      fontSize: "16px",
                      px: 3,
                      width: "96px",
                      height: "52px",
                    }}
                  >
                    Get
                  </Button>
                  </Box>
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
