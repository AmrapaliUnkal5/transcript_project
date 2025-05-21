import React from "react";
import { Container, Typography, Box, List, ListItem, ListItemText, Divider } from "@mui/material";

const CancellationRefundPolicy = () => {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" gutterBottom>
        Cancellation & Refund Policy
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Effective Date: [Insert Date]
      </Typography>

      <Box mt={4}>
        <Typography variant="h6">🔄 1. Cancellation Policy</Typography>

        <Typography variant="subtitle1" mt={2}>a. Subscription Plans</Typography>
        <List>
          <ListItem>
            <ListItemText primary="You may cancel your monthly or annual subscription at any time through your account dashboard or by emailing support@evolra.ai." />
          </ListItem>
          <ListItem>
            <ListItemText primary="Upon cancellation, your account will remain active until the end of your current billing cycle." />
          </ListItem>
          <ListItem>
            <ListItemText primary="No additional charges will be applied after the current billing cycle ends." />
          </ListItem>
        </List>

        <Typography variant="subtitle1" mt={2}>b. Custom Plans or One-Time Projects</Typography>
        <List>
          <ListItem>
            <ListItemText primary="Cancellations must be requested within 24 hours of order confirmation to receive a full refund." />
          </ListItem>
          <ListItem>
            <ListItemText primary="Partial refunds after 24 hours depend on the stage of development." />
          </ListItem>
        </List>
      </Box>

      <Box mt={4}>
        <Typography variant="h6">💸 2. Refund Policy</Typography>

        <Typography variant="subtitle1" mt={2}>a. Standard Refund Window</Typography>
        <List>
          <ListItem>
            <ListItemText primary="7-day refund guarantee on all subscription plans." />
          </ListItem>
          <ListItem>
            <ListItemText primary="Refund requests must be made within 7 days of the initial purchase." />
          </ListItem>
          <ListItem>
            <ListItemText primary="Refunds processed to the original payment method within 7–10 business days." />
          </ListItem>
        </List>

        <Typography variant="subtitle1" mt={2}>b. Refunds After 7 Days</Typography>
        <List>
          <ListItem>
            <ListItemText primary="Generally not issued unless due to technical issues unresolved by support or billing errors." />
          </ListItem>
        </List>

        <Typography variant="subtitle1" mt={2}>c. Custom or Enterprise Projects</Typography>
        <List>
          <ListItem>
            <ListItemText primary="Handled case-by-case depending on project scope and completion status." />
          </ListItem>
          <ListItem>
            <ListItemText primary="Service fees may apply if development has started." />
          </ListItem>
        </List>
      </Box>

      <Box mt={4}>
        <Typography variant="h6">🚫 Non-Refundable Items</Typography>
        <List>
          <ListItem><ListItemText primary="Setup or onboarding fees (if any)" /></ListItem>
          <ListItem><ListItemText primary="Add-on features delivered and consumed" /></ListItem>
          <ListItem><ListItemText primary="Usage-based charges (e.g., API credits consumed)" /></ListItem>
        </List>
      </Box>

      <Box mt={4}>
        <Typography variant="h6">📬 How to Request a Refund</Typography>
        <Typography variant="body1">
          To request a refund, please email us at <strong>support@evolra.ai</strong> with the following:
        </Typography>
        <List>
          <ListItem><ListItemText primary="Your registered email ID" /></ListItem>
          <ListItem><ListItemText primary="Date of purchase" /></ListItem>
          <ListItem><ListItemText primary="Reason for cancellation/refund" /></ListItem>
        </List>
      </Box>

      <Box mt={4}>
        <Typography variant="h6">📝 Policy Changes</Typography>
        <Typography variant="body1">
          Evolra.ai reserves the right to modify this policy at any time. Changes will be reflected on this page with an updated effective date.
        </Typography>
      </Box>

      <Divider sx={{ my: 4 }} />

      

<Typography
  variant="body2"
  color="text.secondary"
  align="center"
>
  © {new Date().getFullYear()} All rights reserved. BytePX Technologies Pvt. Ltd.
</Typography>
    </Container>
  );
};

export default CancellationRefundPolicy;
