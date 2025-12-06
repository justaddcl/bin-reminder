const POSTCODE = "";
const ADDRESS = "";

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;

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
  const req = new Request(`https://api.reading.gov.uk/api/collections/${uprn}`);
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

const setServices = async (collections, stack, widget) => {
  let isBackgroundSet = false;

  for (const collection of collections) {
    const service = servicesMap.find(
      (service) => service.round === collection.round
    );

    const { icon } = service;

    if (!isBackgroundSet) {
      widget.backgroundColor = new Color(service.color, 0.65);
      isBackgroundSet = true;
    }

    const iconReq = new Request(icon);
    const serviceIcon = await iconReq.loadImage();

    const serviceStack = stack.addStack();
    serviceStack.layoutHorizontally();
    serviceStack.centerAlignContent();
    serviceStack.spacing = 8;

    serviceStack.addImage(serviceIcon);

    const serviceText = serviceStack.addText(service?.description);
    serviceText.font = Font.mediumSystemFont(14);
    serviceText.textColor = Color.white();
  }
};

const createWidget = async (collectionsData) => {
  console.log(JSON.stringify(collectionsData, null, 2));

  const { collections } = collectionsData;

  const sortedCollections = collections.sort((collectionA, collectionB) => {
    const dateA = parseDate(collectionA.date);
    const dateB = parseDate(collectionB.date);
    return dateA - dateB;
  });

  const firstCollectionDate = sortedCollections[0].date;
  const firstCollections = sortedCollections.filter(
    (collection) => collection.date === firstCollectionDate
  );

  const dateFormatter = new DateFormatter();
  dateFormatter.locale = "en";
  dateFormatter.dateFormat = "MMM dd";

  const dayFormatter = new DateFormatter();
  dayFormatter.locale = "en";
  dayFormatter.dateFormat = "EEEE";

  const widget = new ListWidget();

  const paddingX = 18;
  const paddingY = 12;
  widget.setPadding(paddingY, paddingX, paddingY, paddingX);

  const headerStack = widget.addStack();
  headerStack.layoutHorizontally();

  const heading = headerStack.addText("Next bin collection");
  heading.font = Font.mediumSystemFont(14);
  heading.textColor = new Color("#ffffff", 0.65);
  headerStack.addSpacer();

  widget.addSpacer();

  const dateHStack = widget.addStack();
  dateHStack.layoutVertically();

  const formattedCollectionDay = dayFormatter.string(
    parseDate(firstCollections[0].date)
  );
  const collectionDay = dateHStack.addText(formattedCollectionDay);
  collectionDay.font = Font.boldSystemFont(24);
  collectionDay.textColor = Color.white();

  const formattedCollectionDate = dateFormatter.string(
    parseDate(firstCollectionDate)
  );
  const collectionDateText = dateHStack.addText(formattedCollectionDate);
  collectionDateText.font = Font.mediumSystemFont(14);
  collectionDateText.textColor = Color.white();

  widget.addSpacer();

  const servicesHStack = widget.addStack();
  servicesHStack.layoutHorizontally();
  servicesHStack.centerAlignContent();
  servicesHStack.spacing = 24;

  console.log(JSON.stringify(firstCollections, null, 2));

  await setServices(firstCollections, servicesHStack, widget);

  widget.addSpacer();

  const timeFormatter = new DateFormatter();
  timeFormatter.locale = "en";
  timeFormatter.dateFormat = "HH:mm:ss";

  const updatedAtText = widget.addText(
    `Updated at: ${timeFormatter.string(new Date())}`
  );
  updatedAtText.font = Font.systemFont(12);
  updatedAtText.textColor = new Color("#ffffff", 0.65);

  return widget;
};

const collectionsData = await fetchData();
const widget = await createWidget(collectionsData);

const now = new Date();
widget.refreshAfterDate = new Date(now + 24 * HOUR);

Script.setWidget(widget);
Script.complete();

widget.presentMedium();
