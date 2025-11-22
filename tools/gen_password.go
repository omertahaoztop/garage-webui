package main

import (
	"fmt"
	"os"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Kullanım: go run gen_password.go <username> <password>")
		fmt.Println("Örnek: go run gen_password.go admin mypassword123")
		os.Exit(1)
	}

	username := os.Args[1]
	password := os.Args[2]

	// Bcrypt hash oluştur (cost 10)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		fmt.Printf("Hata: %v\n", err)
		os.Exit(1)
	}

	// AUTH_USER_PASS formatında çıktı
	fmt.Printf("AUTH_USER_PASS=%s:%s\n", username, string(hash))
	fmt.Printf("\nEnvironment variable olarak kullan:\n")
	fmt.Printf("export AUTH_USER_PASS=\"%s:%s\"\n", username, string(hash))
}

