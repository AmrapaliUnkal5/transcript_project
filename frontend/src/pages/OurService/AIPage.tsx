import React, { useState } from "react";
import {
  Box,
  Typography,
  Grid,
  Button,
  Modal,
  styled,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Styled Image
const StyledImage = styled("img")({
  width: "100%",
  height: "auto",
  objectFit: "cover",
  display: "block",
  borderRadius: "22px",
});

const AIPage: React.FC = () => {
  return (
    <Box sx={{ padding: { xs: 2, sm: 4, md: 6 } }}>
      <Typography
        fontFamily={"instrument sans"}
        fontSize={{ xs: "28px", sm: "40px" }}
        fontWeight={600}
        mb={4}
      >
        AI Agents
      </Typography>

      <Typography
        fontFamily={"instrument sans"}
        fontSize={{ xs: "16px", sm: "20px", md: "22px" }}
        fontWeight={400}
        maxWidth={"945px"}
        width={"100%"}
        mx={"auto"}
        gutterBottom
        mb={4}
        // mx={{ xs: 0, sm: 5 }}
      >
        <span style={{ color: "#9F9F9F" }}>AI agents can handle </span> routine
        customer inquiries 24/7,
        <span style={{ color: "#9F9F9F" }}> reducing </span> wait times and
        freeing up human agents
        <span style={{ color: "#9F9F9F" }}>
          {" "}
          for complex issues. Our agents can{" "}
        </span>{" "}
        manage order tracking, product information, appointment scheduling and
        basic troubleshooting
        <span style={{ color: "#9F9F9F" }}>
          {" "}
          across different business domains.
        </span>
      </Typography>
      <Box
        sx={{
          padding: { xs: 2, sm: 4, md: 6 },
          maxWidth: "1200px",
          mx: "auto",
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <HoverCard
                src="/images/Ai-agent/Customer-support.png"
                title="Customer Support Automation"
                description="AI agents can qualify leads, schedule sales meetings, follow up with prospects, and provide personalized product recommendations."
                modalDescription="AI agents can qualify leads, schedule sales meetings, follow up with prospects, and provide personalized product recommendations. This works well for all businesses by maintaining consistent engagement throughout the sales cycle."
              />
              <HoverCard
                src="/images/Ai-agent/Social_media.png"
                title="Social Media Management"
                description="AI agents schedule posts, respond to comments, analyze engagement metrics, and suggest content improvements."
                modalDescription="AI agents schedule posts, respond to comments, analyze engagement metrics, and suggest content improvements. This helps companies maintain an active online presence and build stronger customer relationships."
              />
              <HoverCard
                src="/images/Ai-agent/virtual_it.png"
                title="Virtual IT Helpdesk (IT Services)"
                description="AI agents provide instant troubleshooting for common IT issues, reset passwords, and escalate complex problems to human technicians."
                modalDescription="AI agents provide instant troubleshooting for common IT issues, reset passwords, and escalate complex problems to human technicians. This reduces downtime and IT support costs for SMEs."
              />
              <HoverCard
                src="/images/Ai-agent/project-dev.png"
                title="Product Development & Feedback Analysis"
                description="Staying responsive to customer needs is critical for product success, but many lack the resources for comprehensive feedback analysis."
                modalDescription="Staying responsive to customer needs is critical for product success, but many lack the resources for comprehensive feedback analysis. AI agents can collect and analyze customer feedback across multiple channels, identify recurring issues or requested features, and help prioritize improvements. "
              />
            </Box>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <HoverCard
                src="/images/Ai-agent/Sales-process.png"
                title="Sales Process Enhancement"
                description="AI agents can qualify leads, schedule sales meetings, follow up with prospects, and provide personalized product recommendations."
                modalDescription="AI agents can qualify leads, schedule sales meetings, follow up with prospects, and provide personalized product recommendations. This works well for all businesses by maintaining consistent engagement throughout the sales cycle."
              />
              <HoverCard
                src="/images/Ai-agent/Employee_onboarding.png"
                title="Employee Onboarding & Training"
                description="AI agents can guide new hires through onboarding processes, provide company policy information, deliver role-specific training, and answer common HR questions."
                modalDescription="AI agents can guide new hires through onboarding processes, provide company policy information, deliver role-specific training, and answer common HR questions. This ensures a smooth onboarding experience and frees up HR staff for more strategic tasks."
              />
              <HoverCard
                src="/images/Ai-agent/personalized-market.png"
                title="Personalized Marketing Campaigns"
                description="AI agents analyze customer data to segment audiences, personalize email and ad content, and automate campaign scheduling."
                modalDescription="AI agents analyze customer data to segment audiences, personalize email and ad content, and automate campaign scheduling. This increases engagement and ROI for marketing efforts with minimal manual intervention."
              />
              <HoverCard
                src="/images/Ai-agent/adminstrative-task.png"
                title="Administrative Task Automation"
                description="AI agents excel at scheduling meetings, managing email correspondence, data entry, and document processing."
                modalDescription="AI agents excel at scheduling meetings, managing email correspondence, data entry, and document processing. This can significantly benefit organizations by reducing administrative overhead."
              />
            </Box>
          </Grid>
        </Grid>
      </Box>
      <Box display="flex" justifyContent="center" mb={[0, 2]} mt={8}>
        <Button
          variant="contained"
          color="primary"
          href="/contact-us"
          size="large"
          sx={{
            fontSize: { xs: "14px", sm: "18px" },
            fontWeight: 500,
            borderRadius: "40px",
            height: { xs: "48px", sm: "62px" },
            minWidth: { xs: "160px", sm: "220px" },
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
  modalDescription: string;
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
            fontSize: { xs: "18px", sm: "22px" },
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
            pb: 2,
            transform: "translateY(100%)",
            transition: "transform 0.3s ease-in-out",
            textAlign: "left",
          }}
        >
          <Typography
            fontSize={{ xs: "16px", sm: "20px" }}
            fontWeight={600}
            mb={1}
          >
            {title}
          </Typography>
          <Typography fontSize={{ xs: "12px", sm: "14px" }} mb={1}>
            {description}
          </Typography>
          <Typography
            onClick={() => setOpen(true)}
            fontSize={{ xs: "12px", sm: "14px" }}
            sx={{
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Read more
          </Typography>
        </Box>
      </Box>

      {/* Modal */}
      <Modal open={open} onClose={() => setOpen(false)}>
        <Box
          sx={{
            position: "relative",
            backgroundColor: "#fff",
            borderRadius: "20px",
            width: { xs: "90%", sm: 400 },
            mx: "auto",
            mt: { xs: "20%", sm: "10%" },
            p: { xs: 2, sm: 4 },
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
              fontSize: { xs: "18px", sm: "20px" },
              color: "#333",
            }}
          >
            {title}
          </Typography>

          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: "14px", sm: "16px" },
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
