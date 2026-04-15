package com.example.myapplication.data.remote

import com.example.myapplication.data.model.WeatherResponse
import com.google.gson.annotations.SerializedName
import retrofit2.http.GET
import retrofit2.http.Query

interface WeatherApi {
    @GET("v1/forecast")
    suspend fun getWeatherData(
        @Query("latitude") lat: Double,
        @Query("longitude") lon: Double,
        @Query("current") current: String = "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_gusts_10m,wind_speed_10m,wind_direction_10m,visibility",
        @Query("daily") daily: String = "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max",
        @Query("hourly") hourly: String = "temperature_2m,relative_humidity_2m,precipitation_probability,surface_pressure",
        @Query("timezone") timezone: String = "auto",
        @Query("forecast_days") days: Int = 7
    ): WeatherResponse
}

interface AirQualityApi {
    @GET("v1/air-quality")
    suspend fun getAirQuality(
        @Query("latitude") lat: Double,
        @Query("longitude") lon: Double,
        @Query("current") current: String = "us_aqi,pm10,pm2_5"
    ): AirQualityResponse
}

data class AirQualityResponse(
    val current: AirQualityCurrent
)

data class AirQualityCurrent(
    @SerializedName("us_aqi") val usAqi: Int,
    val pm10: Double,
    @SerializedName("pm2_5") val pm25: Double
)
