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
    <Box color={"#fff"} px={2} py={5} sx={{ backgroundColor: "#101035" }}>
      <Container maxWidth="lg" disableGutters>
      
            <Box
              px={[2, 6]}
              pt={"50px"}
              pb={5}
              border={"solid 1.5px #8B96D661"}
              borderRadius={'20px'}
              sx={{
                background:
                  "linear-gradient(115.95deg, rgba(84, 71, 157, 0.42) 10.92%, rgba(71, 53, 144, 0.056) 96.4%)",
              }}
            >
              <Typography
                variant="h2"
                fontWeight={600}
                fontSize={["32px", "54px"]}
                sx={{
                  background: "-webkit-linear-gradient(#FFF, #959595)",
                  backgroundClip: "text",
                  textFillColor: "transparent",
                }}
                textAlign={"center"}
                mb={3}
              >
                Are You An Enterprise?
              </Typography>

              <Typography
                variant="h6"
                color={"#AFAFAF"}
                fontWeight={400}
                fontSize="20px"
                textAlign={"center"}
                mb={[4,8]}
              >
                We have custom made features for you
              </Typography>

              <Box>
                <Grid
                  container
                  rowSpacing={4}
                  columnSpacing={{ xs: 2, sm: 2, md: 2 }}
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
                        color="#FFFFFF"
                      >
                        All features from Professional Plan
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
                        Predictive models and insights
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
                      >
                        Custom number of AI chatbots
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
                      >
                        Custom Integrations with your systems
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
                      >
                        Custom AI applications
                      </Typography>
                    </Box>

                    {/* Row 2 */}
                    <Box display="flex" alignItems="center" gap={1}>
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
                      >
                        Personalized Onboarding and training
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
              <Box display={"flex"} justifyContent={"center"} my={2}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
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
