package main

import "testing"

func TestValidateConfig_RateLimitFlag(t *testing.T) {
	tests := []struct {
		name    string
		cfg     config
		wantErr bool
	}{
		{"production with limits", config{Production: true}, false},
		{"dev with limits off", config{RateLimitDisabled: true}, false},
		{"production with limits off", config{Production: true, RateLimitDisabled: true}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateConfig(tt.cfg); (err != nil) != tt.wantErr {
				t.Fatalf("validateConfig() err = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
