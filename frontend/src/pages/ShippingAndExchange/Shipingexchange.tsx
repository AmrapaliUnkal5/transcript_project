import React from "react";
import {
  Container,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  useTheme,
  useMediaQuery,
} from "@mui/material";

export const ShippingExchange = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      sx={{
        backgroundColor: "#101035", 
        color: "#ffffff",
        pt: { xs: 8, md: 15 },
        pb: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="md">
        <Typography 
                variant='h2' 
                fontWeight={600} 
                fontSize={['30px', '54px']} 
                color='#fff'
                textAlign={'center'}
                sx={{
                    background: 'linear-gradient(180deg, #FFFFFF 46.63%, #959595 100%)',
                    backgroundClip: 'text',
                    textFillColor: 'transparent',
                  }}
            >
               Evolra.ai Shipment and Exchange Policy
              </Typography>

        <Box mt={4} fontFamily={"'Instrument Sans', sans-serif"}>
          <Typography variant="h6"  gutterBottom>
            Delivery Policy (Digital Product Delivery)
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Instant Access:</strong> Once the payment is successfully
            processed, users will receive access credentials to their
            personalized chatbot via email within 1 hour.
            <br />
            <br />
            <strong>Onboarding Support:</strong> We provide free onboarding
            assistance within the first 48 hours of purchase to ensure smooth
            setup and configuration.
            <br />
            <br />
            <strong>Custom Integrations (if applicable):</strong> Custom AI bot
            deployments may take 3–5 business days based on integration needs.
            Timelines will be communicated clearly.
          </Typography>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Exchange / Upgrade Policy
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>AI Model Upgrades:</strong> Users can upgrade to a more
            advanced AI model or feature pack at any time. The difference in
            cost will be billed pro-rata.
            <br />
            <br />
            <strong>Customization Adjustments:</strong> If the chatbot behavior
            doesn’t align with the business tone or needs, customers can request
            up to 2 free reconfigurations within the first 14 days.
            <br />
            <br />
            <strong>Plan Swaps:</strong> Switching between plans (e.g., Starter
            ↔ Pro) is allowed anytime, with the new billing cycle reflecting the
            change.
          </Typography>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Refund Policy
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>7-Day Refund Guarantee:</strong> We offer a
            no-questions-asked refund within the first 7 days if the product
            does not meet expectations or isn’t compatible with the user’s
            platform.
            <br />
            <br />
            <strong>Partial Refunds:</strong> Beyond 7 days, partial refunds may
            be issued only if:
          </Typography>
          <List sx={{ pl: 4, listStyleType: "disc" }}>
            <ListItem sx={{ display: "list-item" }}>
              <ListItemText primary="There’s a technical fault that remains unresolved." />
            </ListItem>
            <ListItem sx={{ display: "list-item" }}>
              <ListItemText primary="Service downtime exceeds 24 hours without prior notification." />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Non-Exchangeable Items
          </Typography>
          <List sx={{ pl: 4, listStyleType: "disc" }}>
            <ListItem sx={{ display: "list-item" }}>
              <ListItemText primary="Fully customized bots built for a specific client’s infrastructure." />
            </ListItem>
            <ListItem sx={{ display: "list-item" }}>
              <ListItemText primary="White-labeled chatbot versions." />
            </ListItem>
            <ListItem sx={{ display: "list-item" }}>
              <ListItemText primary="One-time-use AI models or scripts delivered as final exports." />
            </ListItem>
          </List>
        </Box>

        <Box mt={4}>
          <Typography variant="h6" gutterBottom>
            Contact for Support
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Email:</strong> support@evolra.ai
            <br />
            <strong>Chat:</strong> Available 24/7 on our website
            <br />
            <strong>Turnaround Time:</strong> 1–2 hours during business hours
          </Typography>
        </Box>

        <Divider sx={{ my: 4, backgroundColor: "rgba(255,255,255,0.3)" }} />

        <Typography variant="body2" align="center">
          © {new Date().getFullYear()} All rights reserved.  BytePX Technologies
          Pvt. Ltd.
        </Typography>
      </Container>
    </Box>
  );
};
