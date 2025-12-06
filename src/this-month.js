const POSTCODE = "";
const ADDRESS = "";

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;

const ICON_SIZE = 28;

const servicesMap = [
  {
    round: "1ADOM",
    description: "Rubbish",
    icon: "http://demo.yujinelson.com/bin-reminder/img/service-icon--rubbish.png",
    image: "http://demo.yujinelson.com/bin-reminder/img/bin-image--rubbish.png",
    color: "#4d4d4f",
  },
  {
    round: "3AREC",
    description: "Recycling",
    icon: "http://demo.yujinelson.com/bin-reminder/img/service-icon--recycling.png",
    image:
      "http://demo.yujinelson.com/bin-reminder/img/bin-image--recycling.png",
    color: "#ed1c24",
  },
  {
    round: "GREEN2",
    description: "Garden Waste",
    icon: "http://demo.yujinelson.com/bin-reminder/img/service-icon--garden-waste.png",
    image:
      "http://demo.yujinelson.com/bin-reminder/img/bin-image--garden-waste.png",
    color: "#00a651",
  },
  {
    round: "FOOD3",
    description: "Food Waste",
    icon: "http://demo.yujinelson.com/bin-reminder/img/service-icon--food-waste.png",
    image:
      "http://demo.yujinelson.com/bin-reminder/img/bin-image--food-waste.png",
    color: "#4d4d4f",
  },
];

const fetchUprn = async (postcode) => {
  const formattedPostcode = postcode.replace(" ", "%20").toUpperCase();
  const req = new Request(
    `https://api.reading.gov.uk//rbc/getaddresses/${formattedPostcode}`
  );
  const res = await req.loadJSON();

  const addresses = res.Addresses;
  const address = addresses.find((address) =>
    address.SiteShortAddress.startsWith(ADDRESS)
  );

  return {
    address: address.SiteShortAddress,
    uprn: address.AccountSiteUprn,
  };
};

const fetchSchedule = async (uprn) => {
  const now = new Date();

  const currentMonth = now.getMonth();
  const nextMonth = currentMonth + 1 === 12 ? 0 : currentMonth + 1;
  const currentYear = now.getFullYear();
  const nextYear = currentMonth + 1 === 12 ? currentYear + 1 : currentYear;

  const queryDateFormatter = new DateFormatter();
  queryDateFormatter.locale = "en";
  queryDateFormatter.dateFormat = "yyyy-MM-dd";

  const fromDate = queryDateFormatter.string(
    new Date(currentYear, currentMonth, 1)
  );
  const toDate = queryDateFormatter.string(new Date(nextYear, nextMonth, 1));

  const req = new Request(
    `https://api.reading.gov.uk/api/collections/${uprn}?from_date=${fromDate}&to_date=${toDate}`
  );
  const res = await req.loadJSON();

  const { collections } = res;

  return collections;
};

const fetchData = async () => {
  const { uprn, address } = await fetchUprn(POSTCODE);
  const collections = await fetchSchedule(uprn);
  return { uprn, collections, address };
};

const parseDate = (dateString) => {
  const [date] = dateString.split(" ");
  const [day, month, year] = date.split("/");
  return new Date(year, month - 1, day);
};

const groupCollectionsByDate = (collections) => {
  const parse = (d) => {
    const [day, month, year] = d.split(" ")[0].split("/");
    return new Date(year, month - 1, day);
  };

  const sorted = [...collections].sort((a, b) => parse(a.date) - parse(b.date));

  const grouped = sorted.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = { date: item.date, rounds: [] };
    }
    acc[item.date].rounds.push(item.round);
    return acc;
  }, {});

  const result = Object.values(grouped);

  // Ensure FOOD3 does not appear first
  result.forEach((entry) => {
    if (entry.rounds[0] === "FOOD3" && entry.rounds.length > 1) {
      entry.rounds = [...entry.rounds.filter((r) => r !== "FOOD3"), "FOOD3"];
    }
  });

  return result;
};

const setServices = async (collection, servicesStack, widget) => {
  let isBackgroundSet = false;

  for (const round of collection.rounds) {
    const service = servicesMap.find((service) => service.round === round);
    if (!service) continue;

    const { icon, color } = service;

    if (!isBackgroundSet && collection.rounds.length > 1 && round !== "FOOD3") {
      widget.backgroundColor = new Color(color, 0.5);
      isBackgroundSet = true;
    }

    const iconReq = new Request(icon);
    const serviceIcon = await iconReq.loadImage();

    const serviceIconStack = servicesStack.addStack();
    serviceIconStack.layoutHorizontally();
    serviceIconStack.centerAlignContent();
    serviceIconStack.spacing = 6;

    const addedIcon = serviceIconStack.addImage(serviceIcon);
    addedIcon.imageSize = new Size(ICON_SIZE, ICON_SIZE);
  }
};

const createWidget = async (collectionsData) => {
  // console.log(JSON.stringify(collectionsData, null, 2));
  const { collections } = collectionsData;

  const groupedCollections = groupCollectionsByDate(collections);
  console.log(JSON.stringify(groupedCollections, null, 2));

  const firstCollectionDate = groupedCollections[0].date;
  const firstCollections = groupedCollections.filter(
    (collection) => collection.date === firstCollectionDate
  );

  const dateFormatter = new DateFormatter();
  dateFormatter.locale = "en";
  dateFormatter.dateFormat = "MMM dd";

  const dayFormatter = new DateFormatter();
  dayFormatter.locale = "en";
  dayFormatter.dateFormat = "EEEE";

  const widget = new ListWidget();

  const paddingX = 24;
  const paddingY = 24;
  widget.setPadding(paddingY, paddingX, paddingY, paddingX);

  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();

  const monthFormatter = new DateFormatter();
  monthFormatter.locale = "en";
  monthFormatter.dateFormat = "MMMM yyyy";

  const month = monthFormatter.string(new Date());

  const heading = headerStack.addText(month);
  heading.font = Font.mediumSystemFont(18);
  heading.textColor = new Color("#ffffff", 0.75);
  headerStack.addSpacer();

  widget.addSpacer();

  const collectionsStack = widget.addStack();
  collectionsStack.layoutVertically();

  for (const collection of groupedCollections) {
    const rowStack = collectionsStack.addStack();
    rowStack.layoutHorizontally();
    rowStack.centerAlignContent();
    rowStack.spacing = 12;
    rowStack.setPadding(2, 0, 2, 0);

    // Date column
    const dateCol = rowStack.addStack();
    dateCol.layoutVertically();
    dateCol.centerAlignContent();

    const dateColumnWidth = 112;
    dateCol.size = new Size(dateColumnWidth, 0);

    const [collectionDate] = collection.date.split(" ");
    const [day, month, year] = collectionDate.split("/");

    const collectionDateFormatter = new DateFormatter();
    collectionDateFormatter.locale = "en";
    collectionDateFormatter.dateFormat = "EEE MMM dd"; // e.g. Mon Dec 01

    const dateText = collectionDateFormatter.string(
      new Date(year, month - 1, day)
    );

    const dateLabel = dateCol.addText(dateText);
    dateLabel.font = Font.boldSystemFont(18);
    dateLabel.textColor = Color.white();

    // Service icons column
    const servicesCol = rowStack.addStack();
    servicesCol.layoutHorizontally();
    servicesCol.centerAlignContent();
    servicesCol.spacing = 8;

    await setServices(collection, servicesCol, widget);

    // Add more space between collection date rows
    collectionsStack.addSpacer(6);
  }

  widget.addSpacer();

  const timeFormatter = new DateFormatter();
  timeFormatter.locale = "en";
  timeFormatter.dateFormat = "HH:mm:ss";

  const updatedAtText = widget.addText(
    `Updated at: ${timeFormatter.string(new Date())}`
  );
  updatedAtText.font = Font.systemFont(10);
  updatedAtText.textColor = new Color("#ffffff", 0.65);

  return widget;
};

const collectionsData = await fetchData();
const widget = await createWidget(collectionsData);

const now = new Date();
widget.refreshAfterDate = new Date(now + 24 * HOUR);

Script.setWidget(widget);
Script.complete();

widget.presentLarge();
