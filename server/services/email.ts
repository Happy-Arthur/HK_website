import { MailService } from '@sendgrid/mail';

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(
  apiKey: string | undefined,
  params: EmailParams
): Promise<boolean> {
  // Check if API key is provided
  if (!apiKey) {
    console.warn('SendGrid API key not provided. Email notification skipped.');
    console.log('[MOCK EMAIL]', {
      to: params.to,
      subject: params.subject,
      text: params.text
    });
    return false;
  }
  
  try {
    // Initialize the mail service with the provided API key
    const mailService = new MailService();
    mailService.setApiKey(apiKey);

    // Send the email
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    
    console.log(`Email sent successfully to ${params.to} with subject: ${params.subject}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}