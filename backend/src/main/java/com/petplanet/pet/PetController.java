package com.petplanet.pet;

import com.petplanet.auth.Auth;
import com.petplanet.auth.AuthInterceptor;
import com.petplanet.pet.PetService.Pet;
import com.petplanet.pet.PetService.PetInput;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/pets")
public class PetController {

    private final PetService pets;

    public PetController(PetService pets) {
        this.pets = pets;
    }

    @GetMapping
    public List<Pet> list(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId) {
        return pets.list(Auth.require(userId));
    }

    @GetMapping("/{petId}")
    public Pet get(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                   @PathVariable("petId") long petId) {
        return pets.get(Auth.require(userId), petId);
    }

    @PostMapping
    public ResponseEntity<Pet> create(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                      @RequestBody PetInput body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(pets.create(Auth.require(userId), body));
    }

    @PutMapping("/{petId}")
    public Pet update(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                      @PathVariable("petId") long petId, @RequestBody PetInput body) {
        return pets.update(Auth.require(userId), petId, body);
    }

    @DeleteMapping("/{petId}")
    public ResponseEntity<Void> delete(@RequestAttribute(name = AuthInterceptor.USER_ID, required = false) Long userId,
                                       @PathVariable("petId") long petId) {
        pets.delete(Auth.require(userId), petId);
        return ResponseEntity.noContent().build();
    }
}
