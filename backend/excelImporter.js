const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');

function cleanStr(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function parseScore(val) {
  if (typeof val === 'number') return Math.max(0, Math.min(5, val));
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : Math.max(0, Math.min(5, parsed));
}

function normalizeCategory(catStr, gender) {
  const str = cleanStr(catStr).toLowerCase();
  const isFemale = gender && cleanStr(gender).toLowerCase() === 'female';

  if (isFemale || str.includes('girl') || str.includes('power') || str.includes('category d')) {
    return { category: 'Category D', playerType: 'Girl Power', defaultBase: 200 };
  }
  if (str.includes('all round') || str.includes('category a')) {
    return { category: 'Category A', playerType: 'All Rounders', defaultBase: 100 };
  }
  if (str.includes('segment') || str.includes('specialist') || str.includes('category b')) {
    return { category: 'Category B', playerType: 'Segment Specialist', defaultBase: 60 };
  }
  if (str.includes('dark horse') || str.includes('category c')) {
    return { category: 'Category C', playerType: 'Dark Horses', defaultBase: 40 };
  }
  return { category: 'Category A', playerType: 'All Rounders', defaultBase: 100 };
}

function normalizeName(name) {
  return cleanStr(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses Excel workbook (from file path or buffer) and converts to Master Player entities.
 */
function parseExcelWorkbook(fileSource, existingPlayers = []) {
  let wb;
  if (Buffer.isBuffer(fileSource)) {
    wb = xlsx.read(fileSource, { type: 'buffer' });
  } else {
    wb = xlsx.readFile(fileSource);
  }

  const existingMap = new Map();
  existingPlayers.forEach(p => {
    if (p.registration_id) existingMap.set(p.registration_id.toLowerCase(), p);
    if (p.full_name) existingMap.set(normalizeName(p.full_name), p);
    if (p.name) existingMap.set(normalizeName(p.name), p);
  });

  const parsedPlayers = [];
  const duplicateList = [];
  const invalidList = [];

  let totalRows = 0;
  let newCount = 0;
  let returningCount = 0;

  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    const isReturningSheet = sheetName.toLowerCase().includes('sheet1') || sheetName.toLowerCase().includes('returning') || sheetName.toLowerCase().includes('old');

    rawRows.forEach((row, rowIdx) => {
      // Find full name column
      let fullName = cleanStr(
        row['Full Name'] || row['Name'] || row['full_name'] || row['Player Name'] || row['player_name']
      );

      // Skip completely blank rows
      if (!fullName && !row['Email ID (MSU one, if not then personal)'] && !row['Email Address']) {
        return;
      }

      totalRows++;

      if (!fullName) {
        invalidList.push({
          sheet: sheetName,
          rowNumber: rowIdx + 2,
          reason: 'Missing player name',
          raw: row
        });
        return;
      }

      const email = cleanStr(
        row['Email ID (MSU one, if not then personal)'] || row['Email Address'] || row['email'] || row['Email']
      );
      const gender = cleanStr(row['Gender'] || row['gender']) || 'Male';

      // Detect if row is returning or new
      const lastYearPriceRaw = row["Last Year's Price"] || row["Last Year Price"] || row["last_year_price"] || row["previousSoldPrice"];
      const hasLastYearPrice = lastYearPriceRaw !== undefined && lastYearPriceRaw !== '' && !isNaN(Number(lastYearPriceRaw)) && Number(lastYearPriceRaw) > 0;
      const playerType = (isReturningSheet || hasLastYearPrice) ? 'RETURNING' : 'NEW';

      if (playerType === 'RETURNING') returningCount++;
      else newCount++;

      const lastYearPrice = hasLastYearPrice ? Number(lastYearPriceRaw) : null;

      // Extract skills / special achievements
      const sportsAchievements = cleanStr(
        row['Please mention any achievement in sports( like played district level, state level or national level) or you have any other special skills.( dancing, singing, video editing, graphic designing etc)? If you dont have any please write NA'] ||
        row['Please mention any achievement in sports (like played district level, state level or national level). If you dont have any please write NA.'] ||
        row['speciality'] || row['Speciality'] || row['Achievement']
      );

      const otherSkills = cleanStr(
        row['Please mention any other special skills (dancing, singing, video editing, graphic designing etc). If you dont have any please write NA.'] ||
        row['xfactor'] || row['X-Factor'] || row['Special Skills']
      );

      const categoryField = row['Category'] || row['Player Category'] || row['category'] || '';
      const catInfo = normalizeCategory(categoryField, gender);

      // Calculate score out of 5 from individual ratings
      const stats = {};
      let ratingSum = 0;
      let ratingCount = 0;

      // Keys to look for
      const potentialRatingKeys = [
        'Cricket', 'Football', 'Basketball', 'Badminton', 'Carrom', 'Chess', 'Foosball',
        'Table Tennis', 'BGMI', 'Valorant', 'Call of Duty Mobile', 'Outdoor sports',
        'Indoor Sports', 'E-sports', 'Strategy Games?', 'Strategy Games', 'Coding skills?', 'Coding skills',
        'Robotics', 'Cultural activities',
        'Rate yourself in Cricket', 'Rate yourself in Football', 'Rate yourself in Basketball',
        'Rate yourself in Badminton', 'Rate yourself in Carrom', 'Rate yourself in Chess',
        'Rate yourself in Foosball', 'Rate yourself in Table Tennis', 'Rate yourself in BGMI',
        'Rate yourself in Valorant', 'Rate yourself in Call of Duty Mobile',
        'Rate yourself in Strategy Games', 'Rate yourself in Robotics',
        'Rate yourself in Cultural activities', 'Rate yourself in Coding skills'
      ];

      potentialRatingKeys.forEach(k => {
        if (row[k] !== undefined && row[k] !== '') {
          const val = parseScore(row[k]);
          const cleanKey = k.replace('Rate yourself in ', '').replace('?', '').trim().toLowerCase().replace(/\s+/g, '_');
          stats[cleanKey] = val;
          ratingSum += val;
          ratingCount++;
        }
      });

      // Calculate score out of 5
      const excelRating = row['Overall RATING'] || row['Overall Rating'] || row['Rating'] || row['overall_rating'];
      let scoreOutOf5 = 3.5;
      if (excelRating && !isNaN(Number(excelRating)) && Number(excelRating) > 0) {
        scoreOutOf5 = Number(Number(excelRating).toFixed(2));
      } else if (ratingCount > 0) {
        scoreOutOf5 = Number((ratingSum / ratingCount).toFixed(2));
      }

      // Convert score out of 5 to overall rating (50 - 99)
      const overallRating = Math.min(99, Math.max(50, Math.round((scoreOutOf5 / 5.0) * 100)));

      // Generate Clean Registration ID
      const prefix = playerType === 'RETURNING' ? '#RET-' : '#NEW-';
      const countForType = playerType === 'RETURNING' ? returningCount : newCount;
      const regId = cleanStr(row['Registration ID'] || row['registration_id']) || `${prefix}${String(countForType).padStart(2, '0')}`;

      // Clean Speciality & X-Factor
      let speciality = '';
      if (sportsAchievements && sportsAchievements.toLowerCase() !== 'na') {
        speciality = sportsAchievements.split('\n')[0].replace(/\r/g, '').trim();
      }

      let xfactor = '';
      if (otherSkills && otherSkills.toLowerCase() !== 'na') {
        xfactor = otherSkills.replace(/\r/g, ' ').replace(/\n/g, ', ').trim();
      } else if (sportsAchievements && sportsAchievements.toLowerCase() !== 'na') {
        xfactor = sportsAchievements.replace(/\r/g, ' ').replace(/\n/g, ', ').slice(0, 140).trim();
      }

      const experience = sportsAchievements && sportsAchievements.toLowerCase() !== 'na' 
        ? (playerType === 'RETURNING' ? '2 Seasons / Verified' : 'District / State Level')
        : (playerType === 'RETURNING' ? '1 Season' : 'Fresh Talent');

      // Check Highlight reasons
      let isHighlighted = false;
      let highlightReason = '';
      if (scoreOutOf5 >= 4.2 || overallRating >= 85) {
        isHighlighted = true;
        highlightReason = 'Top Tier Rating & Versatile Skillset';
      } else if (lastYearPrice && lastYearPrice >= 500) {
        isHighlighted = true;
        highlightReason = 'High Value Returning Asset';
      } else if (xfactor && xfactor.length > 20) {
        isHighlighted = true;
        highlightReason = 'Specialist X-Factor Player';
      }

      const playerObj = {
        id: uuidv4(),
        registration_id: regId,
        full_name: fullName,
        display_name: fullName,
        first_name: fullName.split(' ')[0] || fullName,
        last_name: fullName.split(' ').slice(1).join(' ') || '',
        email,
        gender,
        player_type: playerType, // 'NEW' | 'RETURNING'
        category: catInfo.category, // 'Category A', 'Category B', etc.
        player_type_name: catInfo.playerType, // 'All Rounders', etc.
        base_price: catInfo.defaultBase,
        last_year_price: lastYearPrice,
        score_out_of_5: scoreOutOf5,
        overall_rating: overallRating,
        x_factor: xfactor,
        experience,
        speciality,
        bio: cleanStr(row['Bio'] || row['shortDescription'] || `${catInfo.playerType} - ${xfactor || speciality || 'Versatile athlete'}`),
        image_url: cleanStr(row['Image URL'] || row['imageUrl'] || null) || null,
        image_status: 'DEFAULT',
        is_active: true,
        is_highlighted: isHighlighted,
        highlight_reason: highlightReason,
        stats,
        sheet_source: sheetName,
        row_number: rowIdx + 2,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // Check Duplicate
      const nameKey = normalizeName(fullName);
      const regKey = regId.toLowerCase();
      const existingMatch = existingMap.get(regKey) || existingMap.get(nameKey);

      if (existingMatch) {
        playerObj.is_duplicate = true;
        playerObj.isDuplicate = true;
        playerObj.matchedPlayerId = existingMatch.id;
        playerObj.existing_match = {
          id: existingMatch.id,
          registration_id: existingMatch.registration_id || existingMatch.registrationId,
          full_name: existingMatch.full_name || existingMatch.name
        };
        playerObj.existingMatch = playerObj.existing_match;
        duplicateList.push(playerObj);
      } else {
        existingMap.set(nameKey, playerObj);
        existingMap.set(regKey, playerObj);
      }

      parsedPlayers.push(playerObj);
    });
  });

  return {
    summary: {
      totalRows,
      newPlayers: newCount,
      newPlayersCount: newCount,
      returningPlayers: returningCount,
      returningPlayersCount: returningCount,
      duplicatesCount: duplicateList.length,
      invalidCount: invalidList.length,
      validCount: parsedPlayers.length
    },
    rows: parsedPlayers,
    players: parsedPlayers,
    duplicates: duplicateList,
    invalidRows: invalidList
  };
}

module.exports = {
  parseExcelWorkbook,
  normalizeCategory,
  cleanStr,
  normalizeName
};
