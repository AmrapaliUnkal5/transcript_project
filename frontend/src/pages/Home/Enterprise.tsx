import React from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";
import ReactGA from "react-ga4";
import { trackGAEvent } from "./Hero";
import { getImagePath } from "../../utils/imagePath";

export const Enterprise = () => {
  return (
    <Box color={"#fff"} px={[2, 4]} pb={6} sx={{ backgroundColor: "#101035" }}>
      <Container maxWidth="lg" disableGutters>
        <Box
          px={[2, 9]}
          position={"relative"}
          pt={["40px", "50px"]}
          pb={18}
          border={"solid 1.5px #8B96D661"}
          borderRadius={"20px"}
          sx={{
            background:
              "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",

          }}
          // sx={{
          //   background:
          //     "linear-gradient(115.95deg, #2F1A5E 10.92%, #24114F 96.4%)",  //This is updated color 
        >
          <Typography
            variant="h2"
            fontWeight={600}
            fontSize={["24px", "40px"]}
            sx={{
              background: "-webkit-linear-gradient(#FFF, #959595)",
              backgroundClip: "text",
              textFillColor: "transparent",
            }}
            textAlign={"center"}
            mb={[2.5, 4]}
          >
            Are You An Enterprise?
          </Typography>

          <Typography
            variant="h6"
            color={"#AFAFAF"}
            fontWeight={400}
            fontSize={["16px", "20px"]}
            textAlign={"center"}
            mb={[4, 8]}
          >
            We have custom made features for you
          </Typography>

          <Box>
            <Grid
              container
              rowSpacing={[2, 4]}
              columnSpacing={{ xs: 2, sm: 2, md: 2 }}
            >
              <Grid item xs={12} sm={12} md={4}>
                <Box display="flex" alignItems="center" gap={[0.5, 1]} mb={3}>
                  <StyledImage
                    src={getImagePath("images/icons/icon-check.png")}
                    sx={{
                      width: ["15px", "24px"],
                      height: ["15px", "24px"],
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                    fontSize={["14px", "16px"]}
                  >
                    All features from Professional Plan
                  </Typography>
                </Box>

                {/* Row 2 */}
                <Box display="flex" alignItems="center" gap={[0.5, 1]}>
                  <StyledImage
                    src={getImagePath("images/icons/icon-check.png")}
                    sx={{
                      width: ["15px", "24px"],
                      height: ["15px", "24px"],
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                    fontSize={["14px", "16px"]}
                  >
                    Predictive models and insights
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={4}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src={getImagePath("images/icons/icon-check.png")}
                    sx={{
                      width: ["15px", "24px"],
                      height: ["15px", "24px"],
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                    fontSize={["14px", "16px"]}
                  >
                    Custom number of AI chatbots
                  </Typography>
                </Box>

                {/* Row 2 */}
                <Box display="flex" alignItems="center" gap={1}>
                  <StyledImage
                    src={getImagePath("images/icons/icon-check.png")}
                    sx={{
                      width: ["15px", "24px"],
                      height: ["15px", "24px"],
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFF"
                    fontSize={["14px", "16px"]}
                  >
                    Custom Integrations with your systems
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={4}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src={getImagePath("images/icons/icon-check.png")}
                    sx={{
                      width: ["15px", "24px"],
                      height: ["15px", "24px"],
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                    fontSize={["14px", "16px"]}
                  >
                    Custom AI applications
                  </Typography>
                </Box>

                {/* Row 2 */}
                <Box display="flex" alignItems="center" gap={1}>
                  <StyledImage
                    src={getImagePath("images/icons/icon-check.png")}
                    sx={{
                      width: ["15px", "24px"],
                      height: ["15px", "24px"],
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                    fontSize={["14px", "16px"]}
                  >
                    Personalized onboarding and training
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box
            display={"flex"}
            justifyContent={"center"}
            pt={10}
            pb={5}
            sx={{
              position: "absolute",
              borderRadius: "0px 0px 20px 20px",
              bottom: "1px",
              left: 0,
              right: 0,
            }}
          >
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="contact-us"
              onClick={() => {
                trackGAEvent({
                  category: "Sales",
                  action: "Click_Contact_Sales",
                  label: "contact_sales_from enterprise",
                });
              }}
              sx={{
                fontSize: "18px",
                fontWeight: 500,
                borderRadius: "40px",
                height: "54px",
                minWidth: "170px",
                textTransform: "capitalize",
                mt: 4,
                background:
                  "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%);",
              }}
            >
              Contact Sales
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};
const StyledImage = styled("img")(() => ({
  maxWidth: "100%",
  maxHeight: "100%",
}));
