import React from "react";
import { Box, Typography, Grid, Button, styled } from "@mui/material";

const ProcessAutomationPage: React.FC = () => {
  return (
    <Box sx={{ padding: { xs: 2, sm: 4, md: 6 } }}>
      <Typography
        variant="h4"
        fontFamily="instrument sans"
        fontSize={{ xs: "25px", sm: "36px", md: "40px" }}
        fontWeight={600}
        gutterBottom
        mb={4}
      >
        Process Automation
      </Typography>

      <Box
        sx={{
          padding: { xs: 2, sm: 4, md: 6 },
          maxWidth: "1200px",
          mx: "auto",
        }}
      >
        <Grid
          container
          rowSpacing={[0, 2]}
          columnSpacing={{ xs: 2, sm: 2, md: 3 }}
        >
          {/* Text First on mobile, second on large screens */}
          <Grid item xs={12} md={6} order={{ xs: 2, md: 1 }}>
            <Box
              px={3}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              height="100%"
            >
              <Typography
                variant="h3"
                fontWeight={400}
                fontSize={["14px", "20px"]}
                lineHeight={1.5}
                mb={[3, 6]}
                textTransform="none"
                textAlign="left"
                fontFamily="instrument sans"
              >
                Eliminate repetitive, time-consuming tasks with our advanced
                process automation capabilities.
              </Typography>
              <Typography
                variant="body1"
                fontWeight={400}
                fontSize={["14px", "20px"]}
                lineHeight={1.5}
                textAlign="left"
                fontFamily="instrument sans"
              >
                By automating routine workflows, your team can save valuable
                time and focus on higher-value activities that drive growth and
                innovation.
              </Typography>
            </Box>
          </Grid>

          {/* Image Second on mobile, first on large screens */}
          <Grid item xs={12} md={6} order={{ xs: 1, md: 2 }}>
            <Box
              sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "instrument sans",
              }}
            >
              <StyledImage
                src="/images/service/img-grid.png"
                sx={{
                  margin: "auto",
                  mb: ["20px", "65px"],
                  width: "100%",
                  maxWidth: "580px",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Section 2 */}
        <Grid
          container
          rowSpacing={3}
          columnSpacing={{ xs: 2, sm: 2, md: 3 }}
          mt={[0, 2]}
        >
          <Grid item xs={12} md={6} order={{ xs: 1, md: 1 }}>
            <Box
              sx={{
                width: "100%",
                maxWidth: "580px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: "url('/images/service/Grid.png')",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "contain",
                position: "relative",
                mx: "auto", 
                height: "100%", 
                minHeight: { xs: "250px", md: "100%" }, 
              }}
            >
              <StyledImage
                src="/images/service/ProcessAutomation2.png"
                sx={{
                  width: "100%",
                  maxWidth: "580px",
                  height: "auto",
                  objectFit: "contain",
                  mb: 0,
                }}
              />
            </Box>
          </Grid>

          {/* Text Second on all screens (text right on desktop) */}
          <Grid item xs={12} md={6} order={2}>
            <Box
              px={3}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="left"
              height="100%"
            >
              <Typography
                variant="h3"
                fontWeight={400}
                fontSize={["14px", "20px"]}
                lineHeight={1.5}
                mb={[3, 6]}
                textTransform="none"
                textAlign="left"
                fontFamily="instrument sans"
              >
                From data entry to customer follow-ups, our platform empowers
                you to streamline operations, reduce errors, and improve overall
                efficiency, making your business more agile and productive.
              </Typography>
              <Typography
                variant="body1"
                fontWeight={400}
                fontSize={["14px", "20px"]}
                lineHeight={1.5}
                textAlign="left"
                fontFamily="instrument sans"
              >
                Power your business with the cutting edge solutions of Evolra,
                today.
              </Typography>

              <Box display="flex" justifyContent="left" mt={4}>
                <Button
                  variant="contained"
                  color="primary"
                  href="/signup"
                  size="large"
                  sx={{
                    fontSize: ["14px", "18px"],
                    fontWeight: 500,
                    borderRadius: "40px",
                    height: ["52px", "62px"],
                    minWidth: ["180px", "220px"],
                    textTransform: "capitalize",
                    background:
                      "linear-gradient(180deg, rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%)",
                  }}
                >
                  Get started for free
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default ProcessAutomationPage;

const StyledImage = styled("img")({
  width: "100%",
  height: "auto",
  borderRadius: "8px",
});
