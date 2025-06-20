import React from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";
import { Grid } from "@mui/material";
import { Button, styled } from "@mui/material";

const WorkplaceBotsPage: React.FC = () => {
  return (
    <Box sx={{ padding: { xs: 2, sm: 4, md: 6 } }}>
      <Typography
        fontFamily="instrument sans"
        fontSize={{ xs: "25px", sm: "36px", md: "40px" }}
        fontWeight={600}
        gutterBottom
        mb={[2, 3, 4]}
        textAlign={["center", "center"]} 
      >
        Internal AI Bots for Employees
      </Typography>

      <Typography
        fontWeight={400}
        fontFamily="instrument sans"
        fontSize={["14px", "22px"]}
        lineHeight={1.6}
        color="#FFFF"
        p={[2, 3, 4]}
        maxWidth={"945px"}
        width={"100%"}
        mx={"auto"}
        textAlign={["center", "center"]}
      >
        Boost your team's productivity with AI-powered internal employee bots
        designed to streamline workflows and simplify day-to-day operations.
        These bots can assist with tasks such as answering internal queries,
        managing schedules, or retrieving company resources, allowing employees
        to focus on more strategic work.
      </Typography>

      <Box
        sx={{
          padding: { xs: 2, sm: 4, md: 6 },
          maxWidth: "1200px",
          mx: "auto",
        }}
      >
        <Grid container rowSpacing={2} columnSpacing={{ xs: 2, sm: 2, md: 2 }}>
          <Grid item sm={12} md={6}>
            <Box
              px={3}
              display="flex"
              flexDirection="column"
              justifyContent="center"
              height={"100%"}
            >
              <Typography
                variant="h3"
                fontWeight={600}
                fontSize={{ xs: "20px", sm: "36px", md: "40px" }}
                lineHeight={1.5}
                textAlign="left"
                mb={6}
                fontFamily={"instrument sans"}
              >
                Easy Plug and Play
              </Typography>
              <Typography
                variant="body1"
                fontWeight={400}
                fontSize={["14px", "20px"]}
                lineHeight={1.5}
                textAlign="left"
              >
                Available as a standalone application or a convenient Chrome
                plugin, these bots integrate seamlessly into your existing tools
                and processes, making them an invaluable asset for improving
                efficiency and collaboration across your organization.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={12} md={6}>
            <Box
              sx={{
                height: "100%",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StyledImage
                src="/images/workspace/bot1.png"
                sx={{
                  backgroundImage: "url(/images/service/Grid.png)",
                  margin: "auto",
                  marginBottom: "65px",
                  width: "100%",
                  maxWidth: "580px",
                  objectFit: "cover",
                }}
              />
            </Box>
          </Grid>

          <Grid item xs={12}>
            <Typography
              variant="h4"
              fontWeight={600}
              fontSize={{ xs: "25px", sm: "36px", md: "40px" }}
              fontFamily="instrument sans"
            >
              Common Use Cases
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Box pt={["48px", "68px"]} pb={["0px", "24px"]}>
              <Box mb={"24px"}>
                <StyledImage
                  src="/images/workspace/hr.png"
                  sx={{ margin: "auto" }}
                />
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                fontSize={["16px", "22px"]}
                lineHeight={1}
                mb={2}
                textTransform="none"
                textAlign={"left"}
              >
                HR Support
              </Typography>
              <Typography
                variant="body1"
                color={"#9F9F9F"}
                fontSize={["12px", "14px", "16px"]}
                fontWeight={400}
                fontFamily={"instrument sans"}
                textAlign={"left"}
              >
                Answering questions about leave policies, benefits, payroll, and
                onboarding processes.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box pt={["48px", "68px"]} pb={["0px", "24px"]}>
              <Box mb={"24px"}>
                <StyledImage
                  src="/images/workspace/ithelpdesk.png"
                  sx={{ margin: "auto" }}
                />
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                fontSize={["16px", "22px"]}
                lineHeight={1}
                mb={2}
                textTransform="none"
                textAlign={"left"}
              >
                IT Helpdesk
              </Typography>
              <Typography
                variant="body1"
                color={"#9F9F9F"}
                fontSize={["12px", "14px", "16px"]}
                fontWeight={400}
                fontFamily={"instrument sans"}
                textAlign={"left"}
              >
                Troubleshooting common technical issues, resetting passwords,
                and guiding employees through software installations.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box pt={["48px", "68px"]} pb={["0px", "24px"]}>
              <Box mb={"24px"}>
                <StyledImage
                  src="/images/workspace/knowledge-management.png"
                  sx={{ margin: "auto" }}
                />
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                fontSize={["16px", "22px"]}
                lineHeight={1}
                mb={2}
                textTransform="none"
                textAlign={"left"}
              >
                Knowledge Management
              </Typography>
              <Typography
                variant="body1"
                color={"#9F9F9F"}
                fontSize={["12px", "14px", "16px"]}
                fontWeight={400}
                fontFamily={"instrument sans"}
                textAlign={"left"}
              >
                Providing instant access to company policies, procedures, and
                documentation.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box pt={["48px", "68px"]} pb={["0px", "24px"]}>
              <Box mb={"24px"}>
                <StyledImage
                  src="/images/workspace/facilities-request.png"
                  sx={{ margin: "auto" }}
                />
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                fontSize={["16px", "22px"]}
                lineHeight={1}
                mb={2}
                textTransform="none"
                textAlign={"left"}
              >
                Facilities Requests
              </Typography>
              <Typography
                variant="body1"
                color={"#9F9F9F"}
                fontSize={["12px", "14px", "16px"]}
                fontWeight={400}
                fontFamily={"instrument sans"}
                textAlign={"left"}
              >
                Logging maintenance requests, booking meeting rooms, or
                reporting issues.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box pt={["48px", "68px"]} pb={["0px", "24px"]}>
              <Box mb={"24px"}>
                <StyledImage
                  src="/images/workspace/travel-and-expense-assitence.png"
                  sx={{ margin: "auto" }}
                />
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                fontSize={["16px", "22px"]}
                lineHeight={1}
                mb={2}
                textTransform="none"
                textAlign={"left"}
              >
                Travel and Expense Assistance
              </Typography>
              <Typography
                variant="body1"
                color={"#9F9F9F"}
                fontSize={["12px", "14px", "16px"]}
                fontWeight={400}
                fontFamily={"instrument sans"}
                textAlign={"left"}
              >
                Guiding employees through travel booking, expense submission,
                and reimbursement processes.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Box pt={["48px", "68px"]} pb={["0px", "24px"]}>
              <Box mb={"24px"}>
                <StyledImage
                  src="/images/workspace/Training-and-development.png"
                  sx={{ margin: "auto" }}
                />
              </Box>
              <Typography
                variant="h5"
                fontWeight={600}
                fontSize={["16px", "22px"]}
                lineHeight={1}
                mb={2}
                textTransform="none"
                textAlign="left"
              >
                Training and Development
              </Typography>
              <Typography
                variant="body1"
                color={"#9F9F9F"}
                fontSize={["12px", "14px", "16px"]}
                fontWeight={400}
                fontFamily={"instrument sans"}
                textAlign="left"
              >
                Recommending relevant training modules, tracking progress, and
                answering questions about learning resources.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <Box display={"flex"} justifyContent={"center"} mb={[0, 2]} mt={4}>
        <Button
          variant="contained"
          color="primary"
          href="/contact-us"
          size="large"
          sx={{
            fontSize: ["14px", "18px"],
            fontWeight: 500,
            borderRadius: "40px",
            height: ["52px", "62px"],
            minWidth: ["180px", "220px"],
            textTransform: "none",
            background:
              "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%);",
          }}
        >
          Let's get in touch
        </Button>
      </Box>
    </Box>
  );
};

export default WorkplaceBotsPage;

const StyledImage = styled("img")({
  width: "100%",
  height: "auto",
  borderRadius: "8px",
});
