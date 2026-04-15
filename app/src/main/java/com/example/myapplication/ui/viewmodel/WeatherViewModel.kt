package com.example.myapplication.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.myapplication.data.model.WeatherResponse
import com.example.myapplication.data.remote.AirQualityResponse
import com.example.myapplication.data.remote.RetrofitClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

sealed class WeatherUiState {
    object Loading : WeatherUiState()
    data class Success(
        val weather: WeatherResponse,
        val airQuality: AirQualityResponse,
        val locationName: String
    ) : WeatherUiState()
    data class Error(val message: String) : WeatherUiState()
}

class WeatherViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<WeatherUiState>(WeatherUiState.Loading)
    val uiState: StateFlow<WeatherUiState> = _uiState

    init {
        // Default to Chennai as in the web app
        fetchWeather(13.0827, 80.2707, "Chennai")
    }

    fun fetchWeather(lat: Double, lon: Double, locationName: String) {
        viewModelScope.launch {
            _uiState.value = WeatherUiState.Loading
            try {
                val weather = RetrofitClient.weatherApi.getWeatherData(lat, lon)
                val airQuality = RetrofitClient.airQualityApi.getAirQuality(lat, lon)
                _uiState.value = WeatherUiState.Success(weather, airQuality, locationName)
            } catch (e: Exception) {
                _uiState.value = WeatherUiState.Error(e.message ?: "Unknown error occurred")
            }
        }
    }
}
