package com.example.jarcddemo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

	@GetMapping("/hello")
	public String hello() {
		// 簡単な挨拶メッセージを返す
		return "Hello from Azure DevOps CI/CD!";
	}
} 