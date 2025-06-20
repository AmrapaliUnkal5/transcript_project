// components/PredictiveModelsPage.tsx
import React, { useState } from "react";
import { Box, Typography, Grid, Button, Modal, styled } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";

const AIPage: React.FC = () => {
  return (
    <Box sx={{ padding: { xs: 2, sm: 4, md: 6 } }}>
      <Typography
        variant="h4"
        fontFamily={"instrument sans"}
        fontSize={{ xs: "22px", sm: "30px", md: "40px" }}
        fontWeight={600}
        gutterBottom
        mb={4}
      >
        Predictive Models
      </Typography>

      <Typography
        fontFamily={"instrument sans"}
        fontSize={{ xs: "14px", sm: "18px", md: "22px" }}
        fontWeight={400}
        maxWidth={"945px"}
        width={"100%"}
        mx={"auto"}
        gutterBottom
        mb={4}
      >
        <span style={{ color: "#9F9F9F" }}>
          Predictive AI models have become{" "}
        </span>
        indispensable strategic assets{" "}
        <span style={{ color: "#9F9F9F" }}>
          in today's competitive business landscape,
        </span>{" "}
        transforming how organizations
        <span style={{ color: "#9F9F9F" }}> anticipate </span>market shifts,
        customer behaviors and operational challenges.
        <span style={{ color: "#9F9F9F" }}> By</span> analyzing vast datasets to
        identify patterns
        <span style={{ color: "#9F9F9F" }}>
          {" "}
          invisible to human analysts, these models
        </span>{" "}
        enable businesses to shift from reactive to proactive decision-making{" "}
        <span style={{ color: "#9F9F9F" }}> across every functional area.</span>
      </Typography>

      <Box
        sx={{
          padding: { xs: 2, sm: 4, md: 6 },
          maxWidth: "1200px",
          mx: "auto",
        }}
      >
        <Grid container spacing={2}>
          {/* First column */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {/* 4 Cards */}
              <HoverCard
                src="/images/service/customer-prediction.png"
                title="Customer Churn Prediction"
                description="• Identifies customers likely to cancel services... • Enables proactive retention campaigns before customers leave."
                modalDescription={
                  <>
                    <strong>•</strong> Identifies customers likely to cancel
                    services by analyzing usage patterns, support interactions,
                    billing history, and engagement metrics.
                    <br />
                    <strong>•</strong> Enables proactive retention campaigns
                    before customers leave.
                    <br />
                    <strong>•</strong> Helps prioritize high-value accounts for
                    intervention.
                    <br />
                    <strong>•</strong> Reduces customer acquisition costs by
                    maintaining existing relationships.
                  </>
                }
              />
              <HoverCard
                src="/images/service/student-success.png"
                title="Student Success & Retention Prediction"
                description="• Identifies students at risk... • Enables early intervention..."
                modalDescription={
                  <>
                    <strong>•</strong> Identifies students at risk of academic
                    difficulties or dropping out using engagement metrics,
                    assignment completion patterns, attendance data, and
                    historical performance.
                    <br />
                    <strong>•</strong> Enables early intervention before
                    students fall too far behind.
                    <br />
                    <strong>•</strong> Allows for personalized support
                    allocation based on specific risk factors.
                    <br />
                    <strong>•</strong> Improves graduation rates and
                    institutional effectiveness metrics.
                    <br />
                    <strong>•</strong> Helps optimize student success resources
                    for maximum impact.
                    <br />
                    <strong>•</strong> Supports proactive outreach to struggling
                    students who might not seek help.
                  </>
                }
              />
              <HoverCard
                src="/images/service/patient-appointment.png"
                title="Patient Appointment No-Show Prediction"
                description="• Forecasts which patients are likely to miss... • Enables targeted reminders..."
                modalDescription={
                  <>
                    <strong>•</strong> Forecasts which patients are likely to
                    miss scheduled appointments based on historical attendance
                    patterns, demographics, appointment characteristics,
                    transportation access, and weather conditions.
                    <br />
                    <strong>•</strong> Enables targeted reminder strategies for
                    high-risk patients.
                    <br />
                    <strong>•</strong> Supports intelligent double-booking
                    practices to maximize provider utilization.
                    <br />
                    <strong>•</strong> Reduces revenue loss and provider idle
                    time from unexpected gaps.
                    <br />
                    <strong>•</strong> Improves overall patient access by
                    optimizing scheduling templates.
                    <br />
                    <strong>•</strong> Identifies systemic barriers to
                    appointment adherence for service improvement.
                  </>
                }
              />
              <HoverCard
                src="/images/service/service-escalation.png"
                title="Service Escalation / CSAT Prediction"
                description="• Identifies interactions likely to escalate... • Enables preemptive supervisor involvement..."
                modalDescription={
                  <>
                    <strong>•</strong> Identifies customer service interactions
                    likely to require escalation based on issue characteristics,
                    customer history, and communication patterns.
                    <br />
                    <strong>•</strong> Enables preemptive involvement of
                    supervisors or specialists.
                    <br />
                    <strong>•</strong> Reduces multiple handoffs that frustrate
                    customers.
                    <br />
                    <strong>•</strong> Shortens time-to-resolution for complex
                    issues.
                    <br />
                    <strong>•</strong> Improves first-contact resolution rates
                    through appropriate initial routing.
                  </>
                }
              />
            </Box>
          </Grid>

          {/* Second column */}
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <HoverCard
                src="/images/service/sales-pipeline.png"
                title="Sales Pipeline Conversion Modeling"
                description="• Predicts which leads are most likely to convert... • Helps sales prioritize effectively..."
                modalDescription={
                  <>
                    <strong>•</strong>Predicts which leads and opportunities are
                    most likely to convert based on prospect behavior,
                    communication patterns, and historical deal data.
                    <br />
                    <strong>•</strong> Helps sales teams prioritize
                    high-probability opportunities.
                    <br />
                    <strong>•</strong> Improves forecasting accuracy for revenue
                    planning.
                    <br />
                    <strong>•</strong> Identifies early warning signs of deals
                    at risk.
                  </>
                }
              />
              <HoverCard
                src="/images/service/customer-wait-time.png"
                title="Customer Wait Times Prediction"
                description="• Forecasts wait times using queue and staffing data... • Displays estimates on screens or apps..."
                modalDescription={
                  <>
                    <strong>•</strong> Forecasts customer wait times based on
                    current queue length, transaction types of waiting
                    customers, staffing levels, time of day, and day of month
                    patterns.
                    <br />
                    <strong>•</strong> Displays estimated wait times on digital
                    signage or mobile apps to set appropriate expectations.
                    <br />
                    <strong>•</strong> Supports proactive queue management
                    during peak periods like paydays and lunch hours.
                    <br />
                    <strong>•</strong> Identifies optimal timing for scheduled
                    breaks to minimize customer impact.
                    <br />
                    <strong>•</strong> Enables personalized wait notifications
                    through mobile apps based on individual transaction needs.
                  </>
                }
              />
              <HoverCard
                src="/images/service/predictive-maintenance.png"
                title="Predictive Maintenance"
                description="• Anticipates failures using sensors... • Reduces emergency repairs..."
                modalDescription={
                  <>
                    <strong>•</strong> Anticipates equipment failures before
                    they occur by analyzing sensor data, usage patterns, and
                    maintenance history.
                    <br />
                    <strong>•</strong> Reduces costly unplanned downtime and
                    emergency repairs.
                    <br />
                    <strong>•</strong> IExtends asset lifecycles through
                    optimized maintenance schedules.
                    <br />
                    <strong>•</strong> Improves safety by addressing potential
                    failures proactively.
                  </>
                }
              />
              <HoverCard
                src="/images/service/next-based.png"
                title="Next-Best-Action Prediction"
                description="• Suggests personalized next steps... • Optimizes timing and channels..."
                modalDescription={
                  <>
                    <strong>•</strong> Recommends optimal next steps for
                    customer interactions based on historical engagement
                    patterns, transaction history, and current context.
                    <br />
                    <strong>•</strong> Suggests personalized product offerings,
                    communication timing, and channel preferences.
                    <br />
                    <strong>•</strong> Enhances customer experience by
                    anticipating needs before they're expressed.
                    <br />
                    <strong>•</strong> Improves conversion rates by delivering
                    the right message at the right moment.
                    <br />
                    <strong>•</strong> Supports consistent customer engagement
                    strategies across touchpoints.
                  </>
                }
              />
            </Box>
          </Grid>
        </Grid>
      </Box>
      <Box display={"flex"} justifyContent={"center"} mb={[0, 2]} mt={8}>
        <Button
          variant="contained"
          color="primary"
          href="/contact-us"
          size="large"
          sx={{
            fontSize: { xs: "14px", sm: "16px", md: "18px" },
            fontWeight: 500,
            borderRadius: "40px",
            height: ["44px", "52px", "62px"],
            minWidth: ["150px", "180px", "220px"],
            textTransform: "none",
            background:
              "linear-gradient(180deg,rgba(90, 108, 242, 1) 0%, rgba(75, 52, 152, 1) 100%)",
          }}
        >
          Let's get in touch
        </Button>
      </Box>
    </Box>
  );
};

export default AIPage;

// Styled Image
const StyledImage = styled("img")({
  width: "100%",
  height: "auto",
  objectFit: "cover",
  display: "block",
  borderRadius: "22px",
});

// HoverCard Component
const HoverCard = ({
  src,
  title,
  description,
  modalDescription,
}: {
  src: string;
  title: string;
  description: string;
  modalDescription: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          position: "relative",
          borderRadius: "22px",
          overflow: "hidden",
          cursor: "pointer",
          "&:hover .hoverTitle": {
            opacity: 0,
            transform: "translateY(-10px)",
          },
          "&:hover .hoverContent": {
            transform: "translateY(0)",
          },
        }}
      >
        <StyledImage src={src} />

        <Box
          className="hoverTitle"
          sx={{
            position: "absolute",
            bottom: 16,
            left: 16,
            color: "#fff",
            fontSize: { xs: "16px", sm: "18px", md: "22px" },
            fontWeight: 600,
            fontFamily: "instrument sans",
            zIndex: 1,
            transition: "opacity 0.3s ease-in-out, transform 0.1s ease-in-out",
          }}
        >
          {title}
        </Box>

        <Box
          className="hoverContent"
          sx={{
            position: "absolute",
            bottom: 0,
            width: "100%",
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            px: 2,
            pt: 1,
            pb: [0, 2],
            transform: "translateY(100%)",
            transition: "transform 0.3s ease-in-out",
            textAlign: "left",
          }}
        >
          <Typography
            fontSize={{ xs: "16px", sm: "18px", md: "22px" }}
            fontWeight={600}
            mb={1}
            fontFamily={"instrument sans"}
          >
            {title}
          </Typography>
          <Typography fontSize={{ xs: "12px", sm: "13px", md: "14px" }} mb={1}>
            {description}
          </Typography>
          <Typography
            onClick={() => setOpen(true)}
            fontSize={{ xs: "12px", sm: "13px", md: "14px" }}
            sx={{
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Read more
          </Typography>
        </Box>
      </Box>

      <Modal open={open} onClose={() => setOpen(false)}>
        <Box
          sx={{
            position: "relative",
            backgroundColor: "#fff",
            borderRadius: "20px",
            width: { xs: "90%", sm: 400 },
            mx: "auto",
            mt: "10%",
            p: 4,
            boxShadow: "0px 10px 40px rgba(0, 0, 0, 0.2)",
          }}
        >
          <IconButton
            onClick={() => setOpen(false)}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              color: "#666",
              "&:hover": {
                backgroundColor: "#f0f0f0",
              },
            }}
          >
            <CloseIcon />
          </IconButton>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              mb: 2,
              fontSize: { xs: "16px", sm: "18px", md: "20px" },
              color: "#333",
            }}
          >
            {title}
          </Typography>

          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: "13px", sm: "14px", md: "16px" },
              lineHeight: 1.6,
              color: "#555",
            }}
          >
            {modalDescription}
          </Typography>
        </Box>
      </Modal>
    </>
  );
};
