// Seed data for the fictional Hollins Green Neighbourhood Board demo.
// Everything here is invented: places, contributions and residents.
// Map coordinates are on a 1000 x 640 grid.

var PV_DATA = {
  board: "Hollins Green Neighbourhood Board",
  question: "What should change in Hollins Green over the next three years, and where?",

  categories: ["Getting around", "Safety", "Green space", "Housing", "High street", "Services", "Young people"],

  // Round 1: statements already consolidated from residents' map contributions.
  statements: [
    { id: 1,  cat: "Safety",         x: 590, y: 292, place: "Canal towpath",
      text: "Install better lighting along the canal towpath between Mill Bridge and the station." },
    { id: 2,  cat: "Getting around", x: 225, y: 200, place: "Mill Lane terraces",
      text: "Make the Mill Lane terraces a low-traffic neighbourhood, with through-traffic blocked at two points." },
    { id: 3,  cat: "High street",    x: 800, y: 344, place: "Market Street (east)",
      text: "Add free 30-minute parking bays on Market Street to support the shops." },
    { id: 4,  cat: "Getting around", x: 738, y: 150, place: "Brookside to the station",
      text: "Build a protected cycle route from the Brookside estate to the station." },
    { id: 5,  cat: "Young people",   x: 380, y: 262, place: "Old library",
      text: "Reopen the old library building as a youth hub with evening opening." },
    { id: 6,  cat: "Safety",         x: 600, y: 470, place: "Hollins Primary School",
      text: "Introduce a 20mph limit outside Hollins Primary at drop-off and pick-up times." },
    { id: 7,  cat: "High street",    x: 668, y: 344, place: "Market Street (west)",
      text: "Turn empty shop units on Market Street into low-rent space for local makers." },
    { id: 8,  cat: "Housing",        x: 915, y: 255, place: "Former bus depot",
      text: "Allow new homes on the former bus depot site, with at least 30% affordable." },
    { id: 9,  cat: "Green space",    x: 150, y: 455, place: "Hollins Park",
      text: "Protect all of Hollins Park from any future development." },
    { id: 10, cat: "Services",       x: 830, y: 425, place: "Health centre",
      text: "Extend opening hours at the health centre into weekday evenings." },
    { id: 11, cat: "Green space",    x: 702, y: 268, place: "Station Road",
      text: "Plant street trees along Station Road." },
    { id: 12, cat: "High street",    x: 610, y: 392, place: "Market car park",
      text: "Move the Saturday market from the car park onto Market Street itself." },
    { id: 13, cat: "Safety",         x: 430, y: 520, place: "Brookside parade",
      text: "Install CCTV at the Brookside shopping parade." },
    { id: 14, cat: "Green space",    x: 580, y: 596, place: "Brookside allotments",
      text: "Turn the derelict allotments behind Brookside into a community growing space." }
  ],

  // The raw map contributions each statement was consolidated from (shown in "How we got here").
  raw: [
    [1, 575, 300, "towpath is pitch black after 5pm in winter, I won't walk it"],
    [1, 620, 275, "need lights on the canal path near the station"],
    [1, 540, 320, "Mill Bridge underpass and towpath feel unsafe at night"],
    [2, 210, 180, "rat run through Mill Lane every morning, cars doing 40"],
    [2, 260, 230, "close Mill Lane to through traffic so kids can play out"],
    [2, 190, 215, "filter the terraces like they did in Levenshulme"],
    [3, 820, 336, "nowhere to stop for 5 mins to nip into the butchers"],
    [3, 770, 350, "shops are dying because there's no parking on Market St"],
    [4, 720, 190, "no safe way to cycle to the station from Brookside"],
    [4, 760, 120, "segregated bike lane on Station Road please"],
    [4, 600, 300, "would cycle to the train if the route wasn't so scary"],
    [5, 370, 250, "bring back the youth club, kids have nowhere to go"],
    [5, 395, 275, "old library just sits empty, use it for teenagers"],
    [6, 590, 455, "school run traffic is dangerous, cars speed past the gates"],
    [6, 620, 485, "20 limit outside the primary school"],
    [7, 650, 340, "too many empty shops on Market Street"],
    [7, 690, 352, "let local craft businesses use empty units cheaply"],
    [8, 905, 240, "bus depot has been derelict for 6 years, build homes"],
    [8, 935, 270, "we need affordable housing for young people who grew up here"],
    [9, 140, 440, "hands off the park, don't let them build on it"],
    [9, 170, 480, "keep Hollins Park green, it's the only open space we have"],
    [10, 840, 415, "can never get a GP appointment unless I take time off work"],
    [10, 815, 440, "evening appointments at the health centre"],
    [11, 695, 240, "Station Road is grey and bleak, plant some trees"],
    [11, 712, 300, "trees on station road would cool it down in summer"],
    [12, 600, 380, "market is hidden in the car park, put it on the high street"],
    [12, 625, 400, "market on Market Street would bring people to the shops"],
    [13, 420, 510, "antisocial behaviour at the parade most nights"],
    [13, 445, 530, "cameras at the Brookside shops"],
    [14, 570, 590, "the old allotments are full of fly tipping"],
    [14, 600, 605, "community garden on the allotment site"]
  ],

  // How each simulated group leans on each statement (-1 strongly against .. 1 strongly for).
  // The clustering never sees these labels: it has to rediscover the groups from votes alone.
  groupSpec: [
    { n: 52, lean: [0.8, -0.7, 0.8, -0.3, 0.7, 0.6, 0.1, -0.4, 0.9, 0.8, 0.0, -0.6, 0.8, 0.3] },
    { n: 46, lean: [0.9, 0.8, -0.6, 0.9, 0.8, 0.9, 0.6, 0.6, 0.4, 0.7, 0.7, 0.3, -0.5, 0.8] },
    { n: 30, lean: [0.7, 0.3, 0.9, 0.4, 0.6, 0.5, 0.9, 0.6, -0.4, 0.6, 0.4, 0.9, -0.1, 0.6] }
  ]
};

if (typeof module !== "undefined") module.exports = PV_DATA;
