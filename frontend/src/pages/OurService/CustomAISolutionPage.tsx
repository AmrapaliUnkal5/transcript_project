import React from "react";
import { Box, Typography, Grid } from "@mui/material";
import { Button, styled } from "@mui/material";

const CustomAISolutionsPage: React.FC = () => {
  return (
    <Box sx={{ padding: { xs: 2, sm: 4, md: 6 } }}>
      <Typography
        fontFamily={"instrument sans"}
        fontSize={{ xs: "25px", sm: "36px", md: "40px" }}
        fontWeight={600}
        mb={[4, 8]}
        gutterBottom
      >
        Custom AI Solutions
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
          rowSpacing={5}
          columnSpacing={{ xs: 2, sm: 3 }}
          alignItems="flex-start"
        >
          {/* IMAGE FIRST on all small screens including tablet, SECOND on desktop */}
          <Grid item xs={12} md={6} order={{ xs: 1, md: 2 }}>
            <Box
              sx={{
                width: "100%",
                maxWidth: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: "url(/images/service/Grid.png)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRadius: "8px",
                padding: { xs: 2, sm: 4 },
                margin: "0 auto",
              }}
            >
              <StyledImage src="/images/service/customai.png" alt="Custom AI" />
            </Box>
          </Grid>

          {/* TEXT SECOND on mobile and tablet, FIRST on desktop */}
          <Grid item xs={12} md={6} order={{ xs: 2, md: 1 }}>
            <Box
              px={{ xs: 0, sm: 2, md: 4 }}
              mt={{ xs: 0, sm: 0, md: 6 }}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              height="100%"
            >
              <Typography
                fontWeight={400}
                fontSize={{ xs: "14px", sm: "20px" }}
                lineHeight={1.5}
                mb={4}
                textAlign="left"
                fontFamily={"instrument sans"}
              >
                For organizations with unique requirements or high-volume
                demands, we offer tailored solutions designed to meet your
                specific needs.
              </Typography>

              <Typography
                fontWeight={400}
                fontSize={{ xs: "14px", sm: "20px" }}
                lineHeight={1.5}
                mb={4}
                textAlign="left"
                fontFamily={"instrument sans"}
              >
                Whether you require advanced customization, enterprise-grade
                scalability, or specialized integrations, our sales team is
                ready to collaborate with you to develop a solution that aligns
                with your goals.
              </Typography>

              <Typography
                fontWeight={400}
                fontSize={{ xs: "14px", sm: "20px" }}
                lineHeight={1.5}
                textAlign="left"
                fontFamily={"instrument sans"}
              >
                With our custom solutions, you can unlock the full potential of
                AI to address your organization's most complex challenges and
                opportunities.
              </Typography>

              <Box display="flex" justifyContent="flex-start" mt={4}>
                <Button
                  variant="contained"
                  color="primary"
                  href="/signup"
                  size="large"
                  sx={{
                    fontSize: ["14px", "18px"],
                    fontWeight: 600,
                    borderRadius: "40px",
                    height: { xs: "52px", sm: "62px" },
                    minWidth: { xs: "180px", sm: "220px" },
                    textTransform: "none",
                    background:
                      "linear-gradient(180deg, rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%)",
                  }}
                >
                  Let's get in touch
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default CustomAISolutionsPage;

const StyledImage = styled("img")({
  width: "100%",
  height: "auto",
  maxWidth: "100%",
  borderRadius: "8px",
});
