const numberToWords = (num) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  
  const b = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const convertToCrores = (n) => {
    if (n < 10000000) return convertToLakhs(n);
    return (
      convertToCrores(Math.floor(n / 10000000)) +
      ' Crore ' +
      convertToLakhs(n % 10000000)
    );
  };

  const convertToLakhs = (n) => {
    if (n < 100000) return convertToThousands(n);
    return (
      convertToLakhs(Math.floor(n / 100000)) +
      ' Lakh ' +
      convertToThousands(n % 100000)
    );
  };

  const convertToThousands = (n) => {
    if (n < 1000) return convertToHundreds(n);
    return (
      convertToThousands(Math.floor(n / 1000)) +
      ' Thousand ' +
      convertToHundreds(n % 1000)
    );
  };

  const convertToHundreds = (n) => {
    if (n > 99) {
      return (
        a[Math.floor(n / 100)] +
        ' Hundred ' +
        convertToTens(n % 100)
      );
    }
    return convertToTens(n);
  };

  const convertToTens = (n) => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
  };

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  
  let words = convertToCrores(rupees) + ' Rupees';
  
  if (paise > 0) {
    words += ' and ' + convertToTens(paise) + ' Paise';
  }
  
  words += ' Only';
  
  return words.replace(/\s+/g, ' ').trim();
};

const calculateItemAmount = (item, ratePerGram, gstOnMakingCharges = 5, gstOnMetal = 3, isIntraState = true) => {
  let metalAmount = 0;
  
  // Calculate metal amount based on unit
  if (item.metalType === 'Diamond') {
    // Diamond is usually in carats, but for our system we'll use weight
    metalAmount = ratePerGram * item.weight;
  } else {
    metalAmount = ratePerGram * item.weight;
  }
  
  let makingCharges = 0;
  
  // Calculate making charges based on type
  if (item.makingChargesType === 'percentage') {
    makingCharges = (metalAmount * item.makingCharges) / 100;
  } else if (item.makingChargesType === 'GRM') {
    // Per gram making charge
    makingCharges = item.makingCharges * item.weight;
  } else {
    // Fixed making charge
    makingCharges = item.makingCharges;
  }
  
  // Apply discount on making charges if any
  if (item.makingChargesDiscount && item.makingChargesDiscount > 0) {
    makingCharges = makingCharges - (makingCharges * item.makingChargesDiscount / 100);
  }
  
  // Calculate GST on making charges (5%) and metal (3%)
  const gstOnMaking = (makingCharges * gstOnMakingCharges) / 100;
  const gstOnMetalAmount = (metalAmount * gstOnMetal) / 100;
  
  // For intra-state: CGST + SGST (half each), For inter-state: IGST (full)
  if (isIntraState) {
    return {
      metalAmount,
      makingCharges,
      gstOnMakingCGST: gstOnMaking / 2,
      gstOnMakingSGST: gstOnMaking / 2,
      gstOnMetalCGST: gstOnMetalAmount / 2,
      gstOnMetalSGST: gstOnMetalAmount / 2,
      total: metalAmount + makingCharges + gstOnMaking + gstOnMetalAmount
    };
  } else {
    return {
      metalAmount,
      makingCharges,
      gstOnMakingIGST: gstOnMaking,
      gstOnMetalIGST: gstOnMetalAmount,
      total: metalAmount + makingCharges + gstOnMaking + gstOnMetalAmount
    };
  }
};

const calculateExchangeValue = (oldItem, currentRate) => {
  const weight = oldItem.weight;
  const rate = oldItem.rate || currentRate;
  
  let grossValue = weight * rate;
  
  // Apply wastage deduction if any
  if (oldItem.wastageDeduction && oldItem.wastageDeduction > 0) {
    grossValue = grossValue * ((100 - oldItem.wastageDeduction) / 100);
  }
  
  // Apply melting charges if any
  if (oldItem.meltingCharges && oldItem.meltingCharges > 0) {
    grossValue = grossValue - oldItem.meltingCharges;
  }
  
  return Math.max(0, grossValue);
};

const calculateGST = (metalAmount, makingCharges, gstOnMetal = 3, gstOnMaking = 5, isIntraState = true) => {
  const gstOnMetalAmount = (metalAmount * gstOnMetal) / 100;
  const gstOnMakingAmount = (makingCharges * gstOnMaking) / 100;
  
  if (isIntraState) {
    return {
      metalAmount,
      makingCharges,
      gstOnMetal: gstOnMetalAmount,
      gstOnMaking: gstOnMakingAmount,
      gstOnMetalCGST: gstOnMetalAmount / 2,
      gstOnMetalSGST: gstOnMetalAmount / 2,
      gstOnMakingCGST: gstOnMakingAmount / 2,
      gstOnMakingSGST: gstOnMakingAmount / 2,
      total: metalAmount + makingCharges + gstOnMetalAmount + gstOnMakingAmount,
      totalGST: gstOnMetalAmount + gstOnMakingAmount
    };
  } else {
    return {
      metalAmount,
      makingCharges,
      gstOnMetal: gstOnMetalAmount,
      gstOnMaking: gstOnMakingAmount,
      gstOnMetalIGST: gstOnMetalAmount,
      gstOnMakingIGST: gstOnMakingAmount,
      total: metalAmount + makingCharges + gstOnMetalAmount + gstOnMakingAmount,
      totalGST: gstOnMetalAmount + gstOnMakingAmount
    };
  }
};

module.exports = {
  numberToWords,
  calculateItemAmount,
  calculateExchangeValue,
  calculateGST
};
