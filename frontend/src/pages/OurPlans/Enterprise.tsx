import React from "react";
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  styled,
} from "@mui/material";

export const Enterprise = () => {
  return (
    <Box color={"#fff"} px={2} sx={{ backgroundColor: "#101035" }}>
      <Container maxWidth="lg" disableGutters>
        <Box
          px={[2, 6]}
          position={"relative"}
          pt={"50px"}
          pb={18}
          border={"solid 1.5px #8B96D661"}
          borderRadius={"20px"}
          maxWidth={"1134px"}
          sx={{
            background:
              "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
          }}
        >
          <Typography
            variant="h2"
            fontWeight={600}
            fontSize={["24px", "40px"]}
            maxWidth={"928px"}
            mx={"auto"}
            sx={{
              background: "linear-gradient(90deg, #FFF0E0, #D2B390, #FFF0E0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            textAlign="center"
            mb={6}
          >
            Get Advanced Custom Features With Our Enterprise plan
          </Typography>

          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap={1}
            mb={[4, 8]}
          >
            <StyledImage
              src="/images/icons/icon-add-circle.png" // Replace with your logo path
              sx={{
                width: "25px",
                height: "25px",
              }}
            />
            <Typography
              variant="h6"
              color="#AFAFAF"
              fontWeight={400}
             fontSize={["16px", "20px"]}// Adjust the font size for different screen sizes using a responsive approach"20px"
              textAlign="center"
              lineHeight={1.4}
              sx={{
                background: "linear-gradient(90deg, #FFF0E0, #D2B390, #FFF0E0)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              All features from Professional Plan
            </Typography>
          </Box>

          <Box>
            <Grid
              container
              rowSpacing={4}
              columnSpacing={{ xs: 2, sm: 2, md: 1 }}
            >
              <Grid item xs={12} sm={12} md={4}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    fontSize={["14px", "16px"]}
                    color="#FFFFFF"
                  >
                    Custom number of AI chatbots
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
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
                    Custom word count allocation
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                  >
                    Personalized onboarding and training
                  </Typography>
                </Box>

                {/* Row 2 */}
                <Box display="flex" alignItems="center" gap={1}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    color="#FFFFFF"
                  >
                    Enhanced security features
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={4}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
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
                    AI-powered bots for internal teams
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
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

                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
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
                    Custom agent development
                  </Typography>
                </Box>

                {/* Row 2 */}
                <Box display="flex" alignItems="center" gap={1}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
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
                    Dedicated support
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={12} md={4}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
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

                {/* Row 2 */}
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png" // Use a different icon if needed
                    sx={{
                      width: "24px",
                      height: "24px",
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
                    Workflow automation tools
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    fontSize={["14px", "16px"]}
                    color="#FFFFFF"
                  >
                    Custom integrations with your systems
                  </Typography>
                </Box>

                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <StyledImage
                    src="/images/icons/icon-check.png"
                    sx={{
                      width: "24px",
                      height: "24px",
                      marginBottom: 0,
                    }}
                  />
                  <Typography
                    variant="body1"
                    mb={0}
                    lineHeight={1.4}
                    fontSize={["14px", "16px"]}
                    color="#FFFFFF"
                  >
                    Unlimited AI Admin users
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
              // background:
              // "linear-gradient(180deg, rgba(39, 22, 78, 0.06) 0%, rgba(27, 14, 59, 0.758706) 23.83%, #170B33 96.63%)",
            }}
          >
            <Button
              variant="contained"
              color="primary"
              size="large"
              href="/contact-us"
              sx={{
                fontSize: "18px",
                fontWeight: 600,
                borderRadius: "40px",
                height: "54px",
                minWidth: "170px",
                color: "#363637",
                textTransform: "capitalize",
                mt: 4,
                background: "linear-gradient(180deg, #F4F4F6 0%, #7C7C7C 100%)",
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
