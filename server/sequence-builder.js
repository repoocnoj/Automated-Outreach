export function buildSequenceSteps(config) {
  const { emails = 3, linkedinMessages = 0, textMessages = 0, daysBetween = 3 } = config;
  const totalSteps = emails + linkedinMessages + textMessages;
  const steps = [];

  // Distribute modalities across the sequence
  // Pattern: Start and end with email, intersperse LinkedIn and text
  let emailsLeft = emails;
  let linkedinLeft = linkedinMessages;
  let textLeft = textMessages;

  for (let i = 0; i < totalSteps; i++) {
    let modality;

    // First step is always email
    if (i === 0 && emailsLeft > 0) {
      modality = "email";
      emailsLeft--;
    }
    // Every 2nd-3rd step, try LinkedIn or text
    else if (i % 3 === 2 && linkedinLeft > 0) {
      modality = "linkedin";
      linkedinLeft--;
    }
    else if (i % 4 === 3 && textLeft > 0) {
      modality = "text";
      textLeft--;
    }
    // Fill remaining with emails
    else if (emailsLeft > 0) {
      modality = "email";
      emailsLeft--;
    } else if (linkedinLeft > 0) {
      modality = "linkedin";
      linkedinLeft--;
    } else if (textLeft > 0) {
      modality = "text";
      textLeft--;
    }

    steps.push({
      stepNumber: i + 1,
      modality,
      day: i * daysBetween,
      label: `Step ${i + 1}: ${modality.charAt(0).toUpperCase() + modality.slice(1)} (Day ${i * daysBetween})`,
    });
  }

  return steps;
}
