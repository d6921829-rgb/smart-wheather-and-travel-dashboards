const weatherData = {

    chennai: {
        temp: 32,
        condition: "Sunny",
        icon: "☀️",
        humidity: "65%",
        wind: "12 km/h",
        feels: "35°C"
    },

    bangalore: {
        temp: 24,
        condition: "Cloudy",
        icon: "🌤️",
        humidity: "72%",
        wind: "10 km/h",
        feels: "25°C"
    },

    mumbai: {
        temp: 29,
        condition: "Rainy",
        icon: "🌧️",
        humidity: "80%",
        wind: "15 km/h",
        feels: "31°C"
    },

    delhi: {
        temp: 27,
        condition: "Clear",
        icon: "☀️",
        humidity: "55%",
        wind: "9 km/h",
        feels: "28°C"
    },

    hyderabad: {
        temp: 30,
        condition: "Sunny",
        icon: "☀️",
        humidity: "60%",
        wind: "11 km/h",
        feels: "32°C"
    }

};


function checkWeather() {

    const city =
        document
        .getElementById("cityInput")
        .value
        .trim()
        .toLowerCase();

    const error =
        document.getElementById("error");

    if (city === "") {

        error.textContent =
            "⚠️ Please enter a city.";

        return;
    }

    if (!weatherData[city]) {

        error.textContent =
            "❌ City not available. Try Chennai, Bangalore, Mumbai, Delhi or Hyderabad.";

        return;
    }

    error.textContent = "";

    const data = weatherData[city];

    document.getElementById("cityName")
        .textContent =
        city.charAt(0).toUpperCase() +
        city.slice(1);

    document.getElementById("temperature")
        .textContent =
        data.temp + "°C";

    document.getElementById("condition")
        .textContent =
        data.condition;

    document.getElementById("weatherIcon")
        .textContent =
        data.icon;

    document.getElementById("humidity")
        .textContent =
        data.humidity;

    document.getElementById("wind")
        .textContent =
        data.wind;

    document.getElementById("feels")
        .textContent =
        data.feels;


    calculateTravelScore(
        data.condition,
        data.temp
    );

    updateActivities(
        data.condition,
        data.temp
    );

    updatePacking(
        data.condition,
        data.temp
    );

}


function calculateTravelScore(condition, temp) {

    let score = 80;

    if (condition === "Sunny") {

        score = 95;

    } else if (condition === "Clear") {

        score = 90;

    } else if (condition === "Cloudy") {

        score = 82;

    } else if (condition === "Rainy") {

        score = 55;

    }


    if (temp > 35) {

        score -= 10;

    }

    document.getElementById("score")
        .textContent =
        score + "/100";


    if (score >= 85) {

        document.getElementById("advice")
            .textContent =
            "✈️ Excellent day for travelling!";

    } else if (score >= 70) {

        document.getElementById("advice")
            .textContent =
            "😊 Good conditions for exploring.";

    } else {

        document.getElementById("advice")
            .textContent =
            "☔ Consider indoor activities today.";
    }

}


function updateActivities(condition, temp) {

    let beach = "Good";
    let photo = "Good";
    let outdoor = "Good";
    let sightseeing = "Good";


    if (condition === "Sunny") {

        beach = "Excellent";
        photo = "Excellent";

    }


    if (condition === "Rainy") {

        beach = "Not Ideal";
        outdoor = "Avoid";
        sightseeing = "Indoor";

    }


    if (temp > 35) {

        outdoor = "Morning Only";

    }


    document.getElementById("beach")
        .textContent = beach;

    document.getElementById("photo")
        .textContent = photo;

    document.getElementById("outdoor")
        .textContent = outdoor;

    document.getElementById("sightseeing")
        .textContent = sightseeing;

}


function updatePacking(condition, temp) {

    const list =
        document.getElementById("packingList");

    list.innerHTML = "";

    let items = [];

    if (temp > 30) {

        items.push("🕶️ Sunglasses");
        items.push("💧 Water Bottle");
        items.push("🧴 Sunscreen");

    } else {

        items.push("👕 Comfortable Clothes");
    }


    if (condition === "Rainy") {

        items.push("☔ Umbrella");
        items.push("👟 Waterproof Shoes");

    }


    items.forEach(item => {

        const span =
            document.createElement("span");

        span.textContent = item;

        list.appendChild(span);

    });

}